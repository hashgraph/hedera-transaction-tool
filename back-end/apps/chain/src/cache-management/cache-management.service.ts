import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CachedAccount,
  CachedNode,
  TransactionCachedAccount,
  TransactionCachedNode,
  TransactionStatus,
} from '@entities';
import { emitTransactionUpdate, AccountCacheService, NatsPublisherService, NodeCacheService } from '@app/common';

interface CacheRefreshConfig {
  staleThresholdSeconds: number;
  batchSize: number;
  reclaimTimeoutMs: number;
}

@Injectable()
export class CacheManagementService {
  private readonly logger = new Logger(CacheManagementService.name);
  private readonly config: CacheRefreshConfig;

  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private readonly accountCacheService: AccountCacheService,
    private readonly nodeCacheService: NodeCacheService,
    @InjectRepository(CachedAccount)
    private readonly accountRepository: Repository<CachedAccount>,
    @InjectRepository(CachedNode)
    private readonly nodeRepository: Repository<CachedNode>,
    private readonly configService: ConfigService,
    private readonly notificationsPublisher: NatsPublisherService,
  ) {
    this.config = {
      staleThresholdSeconds: this.configService.get<number>('CACHE_STALE_THRESHOLD_SECONDS', 10),
      batchSize: this.configService.get<number>('CACHE_REFRESH_BATCH_SIZE', 100),
      reclaimTimeoutMs: this.configService.get<number>('CACHE_RECLAIM_TIMEOUT_MS', 2 * 60 * 1000),
    };
  }

  //TODO when we add the manual mirrornode sync feature, we can probably increase this from 30 seconds to a few minutes or something,
  //as it is really rarely neeeded except in emergencies and such
  /**
   * Main method to refresh all stale cache entries
   */
  @Cron(CronExpression.EVERY_30_SECONDS, {
    name: 'cache-refresh',
  })
  async refreshStaleCache(): Promise<void> {
    try {
      // 0–2 seconds of jitter, help prevent thundering herd across multiple instances
      const jitterMs = Math.random() * 2000;
      await new Promise((res) => setTimeout(res, jitterMs));

      await this.refreshStaleAccounts();
      await this.refreshStaleNodes();
    } catch (error: any) {
      this.logger.error('Cache refresh job failed', error?.stack ?? error?.message ?? String(error));
      throw error;
    }
  }

  //TODO this can probably run less frequently, like every hour or day
  /**
   * Scheduled job - runs less frequently than refresh since cleanup is less urgent
   * Default: every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'cache-cleanup',
  })
  async cleanupUnusedCache() {
    this.logger.log('Starting cache cleanup job');

    const startTime = Date.now();

    try {
      const accountsRemoved = await this.cleanupUnusedAccounts();

      const nodesRemoved = await this.cleanupUnusedNodes();

      const duration = Date.now() - startTime;
      this.logger.log(
        `Cache cleanup completed in ${duration}ms. ` +
        `Accounts removed: ${accountsRemoved}, Nodes removed: ${nodesRemoved}`
      );

      return { accountsRemoved, nodesRemoved, duration };
    } catch (error: any) {
      this.logger.error('Cache cleanup job failed', error?.stack ?? error?.message ?? String(error));
      throw error;
    }
  }

  async refreshStaleAccounts() {
    const staleTime = new Date(Date.now() - this.config.staleThresholdSeconds * 1000);
    const reclaimDate = new Date(Date.now() - this.config.reclaimTimeoutMs);

    // Non-zero benefit, but mainly to ensure locks are released immediately
    const accountTransactionMap = await this.dataSource.transaction(
      async (manager) => {
        const staleAccounts = await manager
          .createQueryBuilder(CachedAccount, 'c')
          .where('c.lastCheckedAt < :staleTime OR c.lastCheckedAt IS NULL', {
            staleTime,
          })
          .andWhere('(c.refreshToken IS NULL OR c.lastCheckedAt < :reclaimDate)', {
            reclaimDate,
          })
          .orderBy('c.lastCheckedAt', 'ASC')
          .limit(this.config.batchSize)
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getMany();

        if (staleAccounts.length === 0) {
          return new Map<CachedAccount, number[]>();
        }

        const accountIds = staleAccounts.map(a => a.id);

        // Get all transaction associations for these accounts
        // innerJoinAndSelect loads the full Transaction entity
        const transactionAccounts = await manager
          .createQueryBuilder(TransactionCachedAccount, 'tca')
          .innerJoinAndSelect('tca.account', 'account')        // Load the account relation
          .innerJoinAndSelect('tca.transaction', 't')           // Load the transaction relation
          .where('account.id IN (:...accountIds)', { accountIds })
          .getMany();

        // Build map of CachedAccount -> transaction IDs
        const map = new Map<CachedAccount, number[]>();
        for (const account of staleAccounts) {
          const txIds = transactionAccounts
            .filter(ta => ta.account.id === account.id)
            .map(ta => ta.transaction.id);
          map.set(account, txIds);
        }
      }
    );

    if (accountTransactionMap.size === 0) {
      return;
    }

    // Track which transactions need updates
    const transactionsToUpdate = new Set<number>();

    // Refresh outside the transaction
    for (const [account, txIds] of accountTransactionMap) {
      const wasRefreshed = await this.accountCacheService.refreshAccount(account);

      if (wasRefreshed) {
        txIds.forEach(txId => transactionsToUpdate.add(txId));
      }
    }

    // Emit updates for affected transactions
    if (transactionsToUpdate.size > 0) {
      this.logger.log(
        `Refreshed ${accountTransactionMap.size} nodes, updating ${transactionsToUpdate.size} transactions`
      );

      emitTransactionUpdate(
        this.notificationsPublisher,
        Array.from(transactionsToUpdate).map(id => ({ entityId: id }))
      );
    }
  }

  async refreshStaleNodes() {
    const staleTime = new Date(Date.now() - this.config.staleThresholdSeconds * 1000);
    const reclaimDate = new Date(Date.now() - this.config.reclaimTimeoutMs);

    // Fetch stale nodes and their associated transactions in one transaction
    const nodeTransactionMap = await this.dataSource.transaction(
      async (manager) => {
        // Get stale nodes with pessimistic lock
        const staleNodes = await manager
          .createQueryBuilder(CachedNode, 'c')
          .where('c.lastCheckedAt < :staleTime OR c.lastCheckedAt IS NULL', {
            staleTime,
          })
          .andWhere('(c.refreshToken IS NULL OR c.lastCheckedAt < :reclaimDate)', {
            reclaimDate,
          })
          .orderBy('c.lastCheckedAt', 'ASC')
          .limit(this.config.batchSize)
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getMany();

        if (staleNodes.length === 0) {
          return new Map<CachedNode, number[]>();
        }

        const nodeIds = staleNodes.map(n => n.id);

        // Get all transaction associations for these nodes
        // innerJoinAndSelect loads the full Transaction entity
        const transactionNodes = await manager
          .createQueryBuilder(TransactionCachedNode, 'tcn')
          .innerJoinAndSelect('tcn.node', 'node')        // Load the node relation
          .innerJoinAndSelect('tcn.transaction', 't')     // Load the transaction relation
          .where('node.id IN (:...nodeIds)', { nodeIds })
          .getMany();

        // Build map of CachedNode -> transaction IDs
        const map = new Map<CachedNode, number[]>();
        for (const node of staleNodes) {
          const txIds = transactionNodes
            .filter(tn => tn.node.id === node.id)
            .map(tn => tn.transaction.id);
          map.set(node, txIds);
        }

        return map;
      }
    );

    if (nodeTransactionMap.size === 0) {
      return;
    }

    // Track which transactions need updates
    const transactionsToUpdate = new Set<number>();

    // Refresh outside the transaction
    for (const [node, txIds] of nodeTransactionMap) {
      const wasRefreshed = await this.nodeCacheService.refreshNode(node);

      if (wasRefreshed) {
        txIds.forEach(txId => transactionsToUpdate.add(txId));
      }
    }

    // Emit updates for affected transactions
    if (transactionsToUpdate.size > 0) {
      this.logger.log(
        `Refreshed ${nodeTransactionMap.size} nodes, updating ${transactionsToUpdate.size} transactions`
      );

      emitTransactionUpdate(
        this.notificationsPublisher,
        Array.from(transactionsToUpdate).map(id => ({ entityId: id }))
      );
    }
  }

  /**
   * Helper to robustly extract affected row count from driver result
   */
  private extractAffectedCount(result: any): number {
    if (result == null) return 0;
    if (typeof result === 'number') return result;
    return (
      result.affectedRows ??
      result.rowCount ??
      (Array.isArray(result) && result[1]?.affectedRows) ??
      (Array.isArray(result) && result[1]?.rowCount) ??
      0
    );
  }

  /**
   * Optimized account cleanup using SQL queries
   */
  private async cleanupUnusedAccounts(): Promise<number> {
    // Find accounts that have no transaction relationships OR
    // all their transactions are in non-active statuses
    const query = `
      DELETE FROM cached_account
      WHERE id IN (
        SELECT ca.id
        FROM cached_account ca
        LEFT JOIN transaction_cached_account ta ON ta."accountId" = ca.id
        LEFT JOIN transaction t ON ta."transactionId" = t.id
        GROUP BY ca.id
        HAVING 
          COUNT(ta.id) = 0 OR
          COUNT(CASE WHEN t.status IN ($1, $2) THEN 1 END) = 0
      )
    `;

    const result = await this.accountRepository.query(query, [
      TransactionStatus.WAITING_FOR_SIGNATURES,
      TransactionStatus.WAITING_FOR_EXECUTION,
    ]);

    const removedCount = this.extractAffectedCount(result);

    this.logger.log(`Optimized cleanup removed ${removedCount} accounts`);
    return removedCount;
  }

  /**
   * Optimized node cleanup using SQL queries
   */
  private async cleanupUnusedNodes(): Promise<number> {
    // Find nodes that have no transaction relationships OR
    // all their transactions are in non-active statuses
    const query = `
      DELETE FROM cached_node
      WHERE id IN (
        SELECT cn.id
        FROM cached_node cn
        LEFT JOIN transaction_cached_node tn ON tn."nodeId" = cn.id
        LEFT JOIN transaction t ON tn."transactionId" = t.id
        GROUP BY cn.id
        HAVING 
          COUNT(tn.id) = 0 OR
          COUNT(CASE WHEN t.status IN ($1, $2) THEN 1 END) = 0
      )
    `;

    const result = await this.nodeRepository.query(query, [
      TransactionStatus.WAITING_FOR_SIGNATURES,
      TransactionStatus.WAITING_FOR_EXECUTION,
    ]);

    const removedCount = this.extractAffectedCount(result);

    this.logger.log(`Optimized cleanup removed ${removedCount} nodes`);
    return removedCount;
  }
}