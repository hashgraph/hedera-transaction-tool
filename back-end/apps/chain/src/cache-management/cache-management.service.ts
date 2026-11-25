import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CachedAccount,
  CachedNode,
  TransactionStatus,
} from '@entities';
import {
  AccountCacheService,
  MirrorNodeCircuitBreaker,
  NodeCacheService,
} from '@app/common';

@Injectable()
export class CacheManagementService {
  private readonly logger = new Logger(CacheManagementService.name);
  private readonly staleThresholdMs: number;
  private readonly batchSize: number;
  private readonly reclaimTimeoutMs: number;
  private refreshInProgress = false;

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
    private readonly circuitBreaker: MirrorNodeCircuitBreaker,
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
    if (this.refreshInProgress) return;
    this.refreshInProgress = true;
    try {
      // 0–2 seconds of jitter, help prevent thundering herd across multiple instances
      const jitterMs = Math.random() * 2000;
      await new Promise((res) => setTimeout(res, jitterMs));

      await this.refreshStaleAccounts();
      await this.refreshStaleNodes();
    } catch (error: any) {
      this.logger.error('Cache refresh job failed', error?.stack ?? error?.message ?? String(error));
      throw error;
    } finally {
      this.refreshInProgress = false;
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
    const staleAccounts = await this.dataSource.transaction(
      async (manager) =>
        manager
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
          .getMany(),
    );

    if (staleAccounts.length === 0) {
      return;
    }

    // Group accounts by mirrorNetwork
    const networkGroups = new Map<string, CachedAccount[]>();
    for (const account of staleAccounts) {
      const network = account.mirrorNetwork;
      if (!networkGroups.has(network)) {
        networkGroups.set(network, []);
      }
      networkGroups.get(network)!.push(account);
    }

    // Process each network group.
    // A refresh that changes the cached data tells the notifications service itself
    // (see AccountCacheService), so nothing is emitted from here.
    for (const [network, entries] of networkGroups) {
      if (!this.circuitBreaker.isAvailable(network)) {
        this.logger.warn(
          `Skipping ${entries.length} stale account(s) for network "${network}" (circuit open)`,
        );
        continue;
      }

      const errors = new Set<string>();

      for (const account of entries) {
        try {
          await this.accountCacheService.refreshAccount(account);
          this.circuitBreaker.recordSuccess(network);
        } catch (error: any) {
          const stillAvailable = this.circuitBreaker.recordFailure(network);
          const msg = error?.message ?? String(error);
          errors.add(msg);
          if (!stillAvailable) break;
        }
      }

      if (errors.size > 0) {
        this.logger.warn(
          `Account refresh failures for network "${network}": ${Array.from(errors).join('; ')}`,
        );
      }
    }
  }

  async refreshStaleNodes() {
    const staleTime = new Date(Date.now() - this.staleThresholdMs);
    const reclaimDate = new Date(Date.now() - this.reclaimTimeoutMs);

    // Get stale nodes with pessimistic lock
    const staleNodes = await this.dataSource.transaction(
      async (manager) =>
        manager
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
          .getMany(),
    );

    if (staleNodes.length === 0) {
      return;
    }

    // Group nodes by mirrorNetwork
    const networkGroups = new Map<string, CachedNode[]>();
    for (const node of staleNodes) {
      const network = node.mirrorNetwork;
      if (!networkGroups.has(network)) {
        networkGroups.set(network, []);
      }
      networkGroups.get(network)!.push(node);
    }

    // Process each network group.
    // A refresh that changes the cached data tells the notifications service itself
    // (see NodeCacheService), so nothing is emitted from here.
    for (const [network, entries] of networkGroups) {
      if (!this.circuitBreaker.isAvailable(network)) {
        this.logger.warn(
          `Skipping ${entries.length} stale node(s) for network "${network}" (circuit open)`,
        );
        continue;
      }

      const errors = new Set<string>();

      for (const node of entries) {
        try {
          await this.nodeCacheService.refreshNode(node);
          this.circuitBreaker.recordSuccess(network);
        } catch (error: any) {
          const stillAvailable = this.circuitBreaker.recordFailure(network);
          const msg = error?.message ?? String(error);
          errors.add(msg);
          if (!stillAvailable) break;
        }
      }

      if (errors.size > 0) {
        this.logger.warn(
          `Node refresh failures for network "${network}": ${Array.from(errors).join('; ')}`,
        );
      }
    }
  }

  /**
   * Helper to robustly extract affected row count from driver result
   */
  private extractAffectedCount(result: any): number {
    if (result == null) return 0;
    if (typeof result === 'number') return result;
    if (typeof result.affectedRows === 'number') return result.affectedRows;
    if (typeof result.rowCount === 'number') return result.rowCount;
    if (Array.isArray(result) && typeof result[1] === 'number') return result[1];
    if (Array.isArray(result) && typeof result[1]?.affectedRows === 'number')
      return result[1].affectedRows;
    if (Array.isArray(result) && typeof result[1]?.rowCount === 'number')
      return result[1].rowCount;
    return 0;
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
