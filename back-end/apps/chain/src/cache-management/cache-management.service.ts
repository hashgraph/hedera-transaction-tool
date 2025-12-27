import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CachedAccount, CachedNode, TransactionStatus } from '@entities';
import { AccountCacheService, NodeCacheService } from '@app/common/transaction-signature';

interface CacheRefreshConfig {
  staleThresholdSeconds: number;
  batchSize: number;
  retryAttempts: number;
  retryDelayMs: number;
  requestTimeoutMs: number;
  reclaimTimeoutMs: number;
}

@Injectable()
export class CacheManagementService {
  private readonly logger = new Logger(CacheManagementService.name);
  private readonly config: CacheRefreshConfig;

  //TODO a lot of these config things should go into mirronode, i think
  //TODO after a successful refresh, we need to send out a notification for transaction changed
  constructor(
    private readonly accountCacheService: AccountCacheService,
    private readonly nodeCacheService: NodeCacheService,
    @InjectRepository(CachedAccount)
    private readonly accountRepository: Repository<CachedAccount>,
    @InjectRepository(CachedNode)
    private readonly nodeRepository: Repository<CachedNode>,
    private readonly configService: ConfigService,
  ) {
    this.config = {
      staleThresholdSeconds: this.configService.get<number>('CACHE_STALE_THRESHOLD_SECONDS', 10),
      batchSize: this.configService.get<number>('CACHE_REFRESH_BATCH_SIZE', 10),
      retryAttempts: this.configService.get<number>('CACHE_REFRESH_RETRY_ATTEMPTS', 3),
      retryDelayMs: this.configService.get<number>('CACHE_REFRESH_RETRY_DELAY_MS', 1000),
      requestTimeoutMs: this.configService.get<number>('CACHE_REFRESH_TIMEOUT_MS', 5000),
      reclaimTimeoutMs: this.configService.get<number>('CACHE_RECLAIM_TIMEOUT_MS', 2 * 60 * 1000),
    };
  }

  //TODO I've changed my mind agian. I do want to do the skip locked thing. it will reduce the chance of extra stuff being queued up, reducing load and such

  /**
   * Main method to refresh all stale cache entries
   */
  @Cron(CronExpression.EVERY_30_SECONDS, {
    name: 'cache-refresh',
  })
  async refreshStaleCache(): Promise<void> {
    try {
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
    // Prevent overlapping executions
    // if (this.isRunning) {
    //   this.logger.warn('Previous cache cleanup still running, skipping this execution');
    //   return;
    // }

    // this.isRunning = true;

    // try {
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
    // } catch (error) {
    //   this.logger.error('Cache cleanup cron job failed', error.stack);
    // } finally {
    //   this.isRunning = false;
    // }
  }

  //TODO i think i still want to do skip locked or whtaever here, lower the chances of collisions even more
  //and increase refresh velocity
  async refreshStaleAccounts() {
    // find stale rows
    const staleAccounts = await this.accountRepository
      .createQueryBuilder('c')
      .where('c.lastCheckedAt < :staleTime OR c.lastCheckedAt IS NULL', {
        staleTime: new Date(Date.now() - this.config.staleThresholdSeconds * 1000),
      })
      .andWhere('(c.refreshToken IS NULL OR c.lastCheckedAt < :reclaimDate)', {
        reclaimDate: new Date(Date.now() - this.config.reclaimTimeoutMs),
      })
      .limit(100) // optional batch
      .getMany();

    for (const cached of staleAccounts) {
      await this.accountCacheService.refreshAccount(cached);
    }
  }

  async refreshStaleNodes() {
    // find stale rows
    const staleAccounts = await this.nodeRepository
      .createQueryBuilder('c')
      .where('c.lastCheckedAt < :staleTime OR c.lastCheckedAt IS NULL', {
        staleTime: new Date(Date.now() - this.config.staleThresholdSeconds * 1000),
      })
      .andWhere('(c.refreshToken IS NULL OR c.lastCheckedAt < :reclaimDate)', {
        reclaimDate: new Date(Date.now() - this.config.reclaimTimeoutMs),
      })
      .limit(100) // optional batch
      .getMany();

    for (const cached of staleAccounts) {
      await this.nodeCacheService.refreshNode(cached);
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

  // also, actual changes should fire off a transaciton_action thing. maybe not on create, but yes on the tohers (but not for each refresh, but for each job), so that should just be in the cron job stuff
  // well, that's not entirely true if the api request catches something stale and updates it. then it would fire of fa transactionaction on its own. so, just add it to the api stuff (or leave it alone since creating a transaciton fires one off' +
  // 'and we don't currenlty send of an action with transactions affected or what not)
  //
  // if it runs every 10 seconsd, though, how would that look? what are we talking about here anyway? i mean, 50 per sec, 10 sec. 500 requests max. could we hit that max? if so, then what? increase to 30 seconds? i guess it is actually
  // 1500 requests if we have 3 replicas. I suppose it is a trade off we will need to take. Then we can add a manual mirrornode refresh button (with rate limits) that will trigger it manually for a specifica transaction
}