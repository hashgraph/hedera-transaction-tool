import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AccountId, PublicKey } from '@hashgraph/sdk';

import {
  CachedNode,
  CachedNodeAdminKey,
  Transaction,
  TransactionCachedNode,
} from '@entities';
import {
  deserializeKey,
  flattenKeyList,
  isFresh,
  NodeInfoParsed,
  serializeKey,
} from '@app/common';
import { MirrorNodeClient } from './mirror-node.client';
import { CacheHelper } from './cache.helper';
import { RefreshResult, RefreshStatus } from './cache.types';
import { SqlBuilderService } from '../sql';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class NodeCacheService {
  private readonly logger = new Logger(NodeCacheService.name);
  private readonly cacheHelper: CacheHelper;

  private readonly cacheTtlMs: number;
  private readonly claimTimeoutMs: number;

  constructor(
    private readonly mirrorNodeClient: MirrorNodeClient,
    @InjectDataSource('cache')
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly sqlBuilder: SqlBuilderService,
  ) {
    this.cacheHelper = new CacheHelper(dataSource);
    this.cacheTtlMs = this.configService.get<number>('CACHE_STALE_THRESHOLD_MS', 10 * 1000);
    this.claimTimeoutMs = this.configService.get<number>('CACHE_CLAIM_TIMEOUT_MS', 10 * 1000);
  }

  /**
   * Refresh node data by fetching from the mirror network.
   * Used by cron jobs or when an explicit forced refresh is required.
   * Returns parsed node info when refreshed successfully, or null otherwise.
   */
  async refreshNode(cached: CachedNode): Promise<boolean> {
    const nodeId = cached.nodeId;
    const mirrorNetwork = cached.mirrorNetwork;

    // Try to claim the node for refresh
    const { data: claimedNode, claimed } = await this.tryClaimNodeRefresh(nodeId, mirrorNetwork);

    if (!claimed) {
      return false; // Didn't refresh (someone else did it)
    }

    const { status } = await this.performRefreshForClaimedNode(claimedNode);
    return status === RefreshStatus.REFRESHED;
  }

  /**
   * Get node info for a transaction; consults cache first and fetches when stale/missing.
   * Links the transaction to the cached node record when returning cached data.
   */
  async getNodeInfoForTransaction(
    transaction: Transaction,
    nodeId: number,
  ): Promise<NodeInfoParsed | null> {
    if (!transaction || !transaction.mirrorNetwork) {
      return null;
    }

    this.validateNodeId(nodeId);

    const mirrorNetwork = transaction.mirrorNetwork;

    // Get cached data
    const cached = await this.dataSource.manager.findOne(CachedNode, {
      where: { nodeId, mirrorNetwork },
    });

    if (this.hasCompleteData(cached) && isFresh(cached.updatedAt, this.cacheTtlMs)) {
      // Link to transaction even if using cache
      await this.linkTransactionToNode(transaction.id, cached.id);
      return this.parseCachedNode(cached);
    }

    // Cache is stale or doesn't exist - fetch new data
    this.logger.debug(`Fetching node ${nodeId} from mirror node (cache ${cached ? 'stale' : 'missing'})`);

    // Try to claim the node for refresh, create the node if none exists
    const { data: claimedNode, claimed } = await this.tryClaimNodeRefresh(nodeId, mirrorNetwork);

    if (!claimed) {
      // Link to transaction if we have cached data
      await this.linkTransactionToNode(transaction.id, claimedNode.id);

      if (this.hasCompleteData(claimedNode)) {
        return this.parseCachedNode(claimedNode);
      }

      // No cached data
      // This should never happen
      return null;
    }

    const { data } = await this.performRefreshForClaimedNode(claimedNode, transaction.id);
    return data;
  }

  /**
   * Claim refresh for a CachedNode row.
   */
  private tryClaimNodeRefresh(
    nodeId: number,
    mirrorNetwork: string,
  ): Promise<{ data: CachedNode, claimed: boolean }> {
    return this.cacheHelper.tryClaimRefresh(
      this.sqlBuilder,
      CachedNode,
      { nodeId, mirrorNetwork },
      this.claimTimeoutMs,
    );
  }

  /**
   * Persist node data and release the refresh claim.
   *
   * The update is guarded by matching the provided refreshToken so only the claimant
   * can apply the update. If the update does not affect exactly one row, the claim was lost.
   *
   * Also persists admin keys and links the node to a transaction when provided.
   */
  private async saveNodeData(
    nodeId: number,
    mirrorNetwork: string,
    refreshToken: string,
    nodeData?: NodeInfoParsed,
    etag?: string,
    transactionId?: number,
  ): Promise<{ id: number; nodeData?: NodeInfoParsed } | null> {
    const updates = nodeData
      ? {
        nodeAccountId: nodeData.node_account_id.toString(),
        encodedKey: serializeKey(nodeData.admin_key),
        etag,
      }
      : {};

    const id = await this.cacheHelper.saveAndReleaseClaim(
      CachedNode,
      { nodeId, mirrorNetwork },
      refreshToken,
      updates,
    );

    if (!id) {
      return null; // Claim was lost
    }

    // Persist admin keys if present (ignore duplicates)
    if (nodeData) {
      const keys = flattenKeyList(nodeData.admin_key);

      if (keys.length > 0) {
        await this.insertNodeAdminKeys(id, keys);
      }
    }

    // Link to transaction when provided (idempotent)
    if (transactionId) {
      await this.linkTransactionToNode(transactionId, id);
    }

    return { id, nodeData };
  }

  /**
   * Fetch node info from the mirror node and persist changes.
   * - If the mirror node returns 304 (not modified), update timestamps and release claim, but do not overwrite data.
   * - If new data is returned, persist the new values and release claim.
   *
   * Returns the new NodeInfoParsed when updated, or null when 304/not found.
   */
  private async fetchAndSaveNodeInfo(
    nodeId: number,
    mirrorNetwork: string,
    refreshToken: string,
    etag?: string,
    transactionId?: number,
  ): Promise<NodeInfoParsed | null> {
    const fetchedNode = await this.mirrorNodeClient.fetchNodeInfo(
      nodeId,
      mirrorNetwork,
      etag,
    );

    // Handle 304 Not Modified - data hasn't changed
    if (!fetchedNode.data) {
      // Update updatedAt and clear refresh token only
      await this.saveNodeData(
        nodeId,
        mirrorNetwork,
        refreshToken,
        undefined,
        undefined,
        transactionId,
      );
      return null; // Indicates no new data (304)
    }

    // Persist fetched data and clear refresh token
    await this.saveNodeData(
      nodeId,
      mirrorNetwork,
      refreshToken,
      fetchedNode.data,
      fetchedNode.etag,
      transactionId,
    );

    return fetchedNode.data;
  }

  /**
   * Execute the refresh flow for a node this process has claimed.
   * On error, attempt to release the claim so other processes may try.
   */
  private async performRefreshForClaimedNode(
    claimedNode: CachedNode,
    transactionId?: number,
  ): Promise<RefreshResult<NodeInfoParsed>> {
    const nodeId = claimedNode.nodeId;
    const mirrorNetwork = claimedNode.mirrorNetwork;
    try {
      // Fetch and save (this will clear the refresh token)
      const nodeData = await this.fetchAndSaveNodeInfo(
        nodeId,
        mirrorNetwork,
        claimedNode.refreshToken,
        claimedNode?.etag,
        transactionId,
      );

      // If 304 (no new data), return cached data if complete
      if (!nodeData && this.hasCompleteData(claimedNode)) {
        return { status: RefreshStatus.NOT_MODIFIED, data: this.parseCachedNode(claimedNode) };
      }

      if (!nodeData) {
        this.logger.warn(`Node ${nodeId} not found on mirror network ${mirrorNetwork}`);
        return { status: RefreshStatus.NOT_FOUND, data: null };
      }

      if (!this.hasNodeDataChanged(nodeData, claimedNode)) {
        return { status: RefreshStatus.DATA_UNCHANGED, data: nodeData };
      }

      return { status: RefreshStatus.REFRESHED, data: nodeData };
    } catch (error) {
      // On error, clear the refresh token so another process can try
      try {
        await this.saveNodeData(
          nodeId,
          mirrorNetwork,
          claimedNode.refreshToken,
          undefined,
          undefined,
          transactionId,
        );
      } catch (saveError) {
        this.logger.error('Failed to clear refresh token after error', saveError);
      }

      throw error;
    }
  }

  /**
   * Insert an association between a transaction and a cached node.
   * The insertion is idempotent (duplicates are ignored).
   */
  private linkTransactionToNode(
    transactionId: number,
    cachedNodeId: number,
  ): Promise<void> {
    return this.cacheHelper.linkTransactionToEntity(
      TransactionCachedNode,
      transactionId,
      cachedNodeId,
      'cachedNode',
    );
  }

  private insertNodeAdminKeys(
    cachedNodeId: number,
    keys: PublicKey[],
  ): Promise<void> {
    return this.cacheHelper.insertKeys(
      CachedNodeAdminKey,
      cachedNodeId,
      'cachedNode',
      keys,
    );
  }

  /**
   * Validate that the provided nodeId is a non-negative integer.
   * Throws a Bad Request HttpException when invalid.
   */
  private validateNodeId(nodeId: number): void {
    if (nodeId === undefined || nodeId === null || !Number.isInteger(nodeId) || nodeId < 0) {
      throw new HttpException(
        'Invalid node ID: must be a non-negative integer',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Map a CachedNode entity to the NodeInfoParsed shape expected by callers.
   */
  private parseCachedNode(cached: CachedNode): NodeInfoParsed {
    return {
      admin_key: deserializeKey(cached.encodedKey),
      node_account_id: cached.nodeAccountId
        ? AccountId.fromString(cached.nodeAccountId)
        : null,
    } as NodeInfoParsed;
  }

  /**
   * Compare fetched data against cached values to determine if anything meaningful changed.
   * Returns true if data differs (or if there's no prior cached data), false if identical.
   */
  private hasNodeDataChanged(fetchedData: NodeInfoParsed, cached: CachedNode): boolean {
    if (!this.hasCompleteData(cached)) {
      return true;
    }

    const serializedKey = serializeKey(fetchedData.admin_key);
    const keysEqual =
      Buffer.isBuffer(serializedKey) && Buffer.isBuffer(cached.encodedKey)
        ? Buffer.compare(serializedKey, cached.encodedKey) === 0
        : serializedKey === cached.encodedKey;

    if (!keysEqual) {
      return true;
    }

    if (fetchedData.node_account_id?.toString() !== cached.nodeAccountId) {
      return true;
    }

    return false;
  }

  /**
   * Check whether the cached node has both node account id and encoded key present.
   */
  private hasCompleteData(cached: CachedNode | null): boolean {
    return !!(cached?.nodeAccountId && cached?.encodedKey);
  }
}
