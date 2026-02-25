import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PublicKey } from '@hashgraph/sdk';

import {
  CachedAccount,
  CachedAccountKey,
  Transaction,
  TransactionCachedAccount,
} from '@entities';
import {
  AccountInfoParsed,
  deserializeKey,
  flattenKeyList,
  isFresh,
  serializeKey,
} from '@app/common';
import { MirrorNodeClient } from './mirror-node.client';
import { CacheHelper } from './cache.helper';
import { RefreshResult, RefreshStatus } from './cache.types';
import { SqlBuilderService } from '../sql';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class AccountCacheService {
  private readonly logger = new Logger(AccountCacheService.name);
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
   * Refresh account data by fetching from the mirror network.
   * Used by cron jobs or when an explicit forced refresh is required.
   * Returns parsed account info when refreshed successfully, or null otherwise.
   */
  async refreshAccount(cached: CachedAccount): Promise<boolean> {
    const account = cached.account;
    const mirrorNetwork = cached.mirrorNetwork;

    // Try to claim the account for refresh
    const { data: claimedAccount, claimed } = await this.tryClaimAccountRefresh(account, mirrorNetwork);

    if (!claimed) {
      return false; // Didn't refresh (someone else did it)
    }

    const { status } = await this.performRefreshForClaimedAccount(claimedAccount);
    return status === RefreshStatus.REFRESHED;
  }

  /**
   * Get account info for a transaction; consults cache first and fetches when stale/missing.
   * Links the transaction to the cached account record when returning cached data.
   */
  async getAccountInfoForTransaction(
    transaction: Transaction,
    account: string,
  ): Promise<AccountInfoParsed | null> {
    if (!transaction || !transaction.mirrorNetwork) {
      return null;
    }

    this.validateAccount(account);

    const mirrorNetwork = transaction.mirrorNetwork;

    // Get cached data
    const cached = await this.dataSource.manager.findOne(CachedAccount, {
      where: { account, mirrorNetwork },
    });

    if (this.hasCompleteData(cached) && isFresh(cached.updatedAt, this.cacheTtlMs)) {
      // Link to transaction even if using cache
      await this.linkTransactionToAccount(transaction.id, cached.id);
      return this.parseCachedAccount(cached);
    }

    // Cache is stale or doesn't exist - fetch new data
    this.logger.debug(`Fetching account ${account} from mirror node (cache ${cached ? 'stale' : 'missing'})`);

    // Try to claim the account for refresh, create the account row if none exists
    const { data: claimedAccount, claimed } = await this.tryClaimAccountRefresh(account, mirrorNetwork);

    if (!claimed) {
      // Link to transaction
      await this.linkTransactionToAccount(transaction.id, claimedAccount.id);

      if (this.hasCompleteData(claimedAccount)) {
        return this.parseCachedAccount(claimedAccount);
      }

      // No cached data
      // This should never happen
      return null;
    }

    const { data } = await this.performRefreshForClaimedAccount(claimedAccount, transaction.id);
    return data;
  }

  /**
   * Claim refresh for a CachedAccount row.
   */
  private tryClaimAccountRefresh(
    account: string,
    mirrorNetwork: string,
  ): Promise<{ data: CachedAccount, claimed: boolean }> {
    return this.cacheHelper.tryClaimRefresh(
      this.sqlBuilder,
      CachedAccount,
      { account, mirrorNetwork },
      this.claimTimeoutMs,
    );
  }

  /**
   * Persist account data and release the refresh claim.
   *
   * The update is guarded by matching the provided refreshToken so only the claimant
   * can apply the update. If the update does not affect exactly one row, the claim was lost.
   *
   * Also persists account keys and links the account to a transaction when provided.
   */
  private async saveAccountData(
    account: string,
    mirrorNetwork: string,
    refreshToken: string,
    accountData?: AccountInfoParsed,
    etag?: string,
    transactionId?: number,
  ): Promise<{ id: number; accountData?: AccountInfoParsed } | null> {
    const updates = accountData
      ? {
        receiverSignatureRequired: accountData.receiverSignatureRequired,
        encodedKey: serializeKey(accountData.key),
        etag,
      }
      : {};

    const id = await this.cacheHelper.saveAndReleaseClaim(
      CachedAccount,
      { account, mirrorNetwork },
      refreshToken,
      updates,
    );

    if (!id) {
      return null; // Claim was lost
    }

    // Persist account keys if present (ignore duplicates)
    if (accountData) {
      const keys = flattenKeyList(accountData.key);

      if (keys.length > 0) {
        await this.insertAccountKeys(id, keys);
      }
    }

    // Link to transaction when provided (idempotent)
    if (transactionId) {
      await this.linkTransactionToAccount(transactionId, id);
    }

    return { id, accountData };
  }

  /**
   * Fetch account info from the mirror node and persist changes.
   * - If the mirror node returns 304 (not modified), update timestamps and release claim, but do not overwrite data.
   * - If new data is returned, persist the new values and release claim.
   *
   * Returns the new AccountInfoParsed when updated, or null when 304/not found.
   */
  private async fetchAndSaveAccountInfo(
    account: string,
    mirrorNetwork: string,
    refreshToken: string,
    etag?: string,
    transactionId?: number,
  ): Promise<AccountInfoParsed | null> {
    const fetchedAccount = await this.mirrorNodeClient.fetchAccountInfo(
      account,
      mirrorNetwork,
      etag,
    );

    // Handle 304 Not Modified - data hasn't changed
    if (!fetchedAccount.data) {
      // Update updatedAt and clear refresh token only
      await this.saveAccountData(
        account,
        mirrorNetwork,
        refreshToken,
        undefined,
        undefined,
        transactionId,
      );
      return null; // Indicates no new data (304)
    }

    // Persist fetched data and clear refresh token
    await this.saveAccountData(
      account,
      mirrorNetwork,
      refreshToken,
      fetchedAccount.data,
      fetchedAccount.etag,
      transactionId,
    );

    return fetchedAccount.data;
  }

  /**
   * Execute the refresh flow for an account this process has claimed.
   * On error, attempt to release the claim so other processes may try.
   */
  private async performRefreshForClaimedAccount(
    claimedAccount: CachedAccount,
    transactionId?: number,
  ): Promise<RefreshResult<AccountInfoParsed>> {
    const account = claimedAccount.account;
    const mirrorNetwork = claimedAccount.mirrorNetwork;
    try {
      // Fetch and save (this will clear the refresh token)
      const accountData = await this.fetchAndSaveAccountInfo(
        account,
        mirrorNetwork,
        claimedAccount.refreshToken,
        claimedAccount?.etag,
        transactionId,
      );

      // If 304 (no new data), return cached data if complete
      if (!accountData && this.hasCompleteData(claimedAccount)) {
        return { status: RefreshStatus.NOT_MODIFIED, data: this.parseCachedAccount(claimedAccount) };
      }

      if (!accountData) {
        this.logger.warn(`Account ${account} not found on mirror network ${mirrorNetwork}`);
        return { status: RefreshStatus.NOT_FOUND, data: null };
      }

      if (!this.hasAccountDataChanged(accountData, claimedAccount)) {
        return { status: RefreshStatus.DATA_UNCHANGED, data: accountData };
      }

      return { status: RefreshStatus.REFRESHED, data: accountData };
    } catch (error) {
      // On error, clear the refresh token so another process can try
      try {
        await this.saveAccountData(
          account,
          mirrorNetwork,
          claimedAccount.refreshToken,
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
   * Insert an association between a transaction and a cached account.
   * The insertion is idempotent (duplicates are ignored).
   */
  private linkTransactionToAccount(
    transactionId: number,
    cachedAccountId: number,
  ): Promise<void> {
    return this.cacheHelper.linkTransactionToEntity(
      TransactionCachedAccount,
      transactionId,
      cachedAccountId,
      'cachedAccount',
    );
  }

  private insertAccountKeys(
    cachedAccountId: number,
    keys: PublicKey[],
  ): Promise<void> {
    return this.cacheHelper.insertKeys(
      CachedAccountKey,
      cachedAccountId,
      'cachedAccount',
      keys,
    );
  }

  /**
   * Validate that the provided account string is a valid Hedera account ID.
   * Throws a Bad Request HttpException when invalid.
   */
  private validateAccount(account: string): void {
    if (!account || typeof account !== 'string') {
      throw new HttpException('Invalid account ID', HttpStatus.BAD_REQUEST);
    }
    const accountIdRegex = /^\d+\.\d+\.\d+$/;
    if (!accountIdRegex.test(account)) {
      throw new HttpException(
        'Account ID must be in format: shard.realm.num',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Map a CachedAccount entity to the AccountInfoParsed shape expected by callers.
   */
  private parseCachedAccount(cached: CachedAccount): AccountInfoParsed {
    return {
      key: deserializeKey(cached.encodedKey),
      receiverSignatureRequired: cached.receiverSignatureRequired,
    } as AccountInfoParsed;
  }

  /**
   * Compare fetched data against cached values to determine if anything meaningful changed.
   * Returns true if data differs (or if there's no prior cached data), false if identical.
   */
  private hasAccountDataChanged(fetchedData: AccountInfoParsed, cached: CachedAccount): boolean {
    if (!this.hasCompleteData(cached)) {
      return true;
    }

    const serializedKey = serializeKey(fetchedData.key);
    const keysEqual =
      Buffer.isBuffer(serializedKey) && Buffer.isBuffer(cached.encodedKey)
        ? Buffer.compare(serializedKey, cached.encodedKey) === 0
        : serializedKey === cached.encodedKey;

    if (!keysEqual) {
      return true;
    }

    if (fetchedData.receiverSignatureRequired !== cached.receiverSignatureRequired) {
      return true;
    }

    return false;
  }

  /**
   * Check whether the cached account has the required persisted data (encoded key present).
   */
  private hasCompleteData(cached: CachedAccount | null): boolean {
    return !!(cached?.encodedKey);
  }
}
