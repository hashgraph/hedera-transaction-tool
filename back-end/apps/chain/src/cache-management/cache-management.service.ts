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

@Injectable()
export class CacheManagementService {
  private readonly logger = new Logger(CacheManagementService.name);
  private readonly staleThresholdMs: number;
  private readonly batchSize: number;
  private readonly reclaimTimeoutMs: number

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
    this.staleThresholdMs =  this.configService.get<number>('CACHE_STALE_THRESHOLD_MS', 10 * 1000);
    this.batchSize =  this.configService.get<number>('CACHE_REFRESH_BATCH_SIZE', 100);
    this.reclaimTimeoutMs = this.configService.get<number>('CACHE_CLAIM_TIMEOUT_MS', 10 * 1000);
  }

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
    const staleTime = new Date(Date.now() - this.staleThresholdMs);
    const reclaimDate = new Date(Date.now() - this.reclaimTimeoutMs);

    // Non-zero benefit, but mainly to ensure locks are released immediately
    const accountTransactionMap = await this.dataSource.transaction(
      async (manager) => {
        const staleAccounts = await manager
          .createQueryBuilder(CachedAccount, 'c')
          .where('c.updatedAt < :staleTime OR c.updatedAt IS NULL', {
            staleTime,
          })
          .andWhere('(c.refreshToken IS NULL OR c.updatedAt < :reclaimDate)', {
            reclaimDate,
          })
          .orderBy('c.updatedAt', 'ASC')
          .limit(this.batchSize)
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
          .innerJoinAndSelect('tca.transaction', 't')           // Load the transaction relation
          .where('tca.cachedAccountId IN (:...accountIds)', { accountIds })
          .getMany();

        // Build map of CachedAccount -> transaction IDs
        const map = new Map<CachedAccount, number[]>();
        for (const account of staleAccounts) {
          const txIds = transactionAccounts
            .filter(ta => ta.cachedAccountId === account.id)
            .map(ta => ta.transaction.id);
          map.set(account, txIds);
        }

        return map;
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
        `Refreshed ${accountTransactionMap.size} accounts, updating ${transactionsToUpdate.size} transactions`
      );

      emitTransactionUpdate(
        this.notificationsPublisher,
        Array.from(transactionsToUpdate).map(id => ({ entityId: id }))
      );
    }
  }

  async refreshStaleNodes() {
    const staleTime = new Date(Date.now() - this.staleThresholdMs);
    const reclaimDate = new Date(Date.now() - this.reclaimTimeoutMs);

    // Fetch stale nodes and their associated transactions in one transaction
    const nodeTransactionMap = await this.dataSource.transaction(
      async (manager) => {
        // Get stale nodes with pessimistic lock
        const staleNodes = await manager
          .createQueryBuilder(CachedNode, 'c')
          .where('c.updatedAt < :staleTime OR c.updatedAt IS NULL', {
            staleTime,
          })
          .andWhere('(c.refreshToken IS NULL OR c.updatedAt < :reclaimDate)', {
            reclaimDate,
          })
          .orderBy('c.updatedAt', 'ASC')
          .limit(this.batchSize)
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
          .innerJoinAndSelect('tcn.transaction', 't')     // Load the transaction relation
          .where('tcn.cachedNodeId IN (:...nodeIds)', { nodeIds })
          .getMany();

        // Build map of CachedNode -> transaction IDs
        const map = new Map<CachedNode, number[]>();
        for (const node of staleNodes) {
          const txIds = transactionNodes
            .filter(tn => tn.cachedNodeId === node.id)
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
      (Array.isArray(result) && typeof result[1] === 'number' ? result[1] : null) ??
      (Array.isArray(result) ? result[1]?.affectedRows ?? null : null) ??
      (Array.isArray(result) ? result[1]?.rowCount ?? null : null) ??
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
        LEFT JOIN transaction_cached_account ta ON ta."cachedAccountId" = ca.id
        LEFT JOIN transaction t ON ta."transactionId" = t.id
        WHERE ca."refreshToken" IS NULL
          AND ca."updatedAt" < NOW() - INTERVAL '5 minutes'
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
        LEFT JOIN transaction_cached_node tn ON tn."cachedNodeId" = cn.id
        LEFT JOIN transaction t ON tn."transactionId" = t.id
        WHERE cn."refreshToken" IS NULL
          AND cn."updatedAt" < NOW() - INTERVAL '5 minutes'
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