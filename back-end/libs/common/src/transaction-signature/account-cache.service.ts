import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  CachedAccount,
  CachedAccountKey,
  Transaction,
  TransactionCachedAccount,
} from '@entities';
import { AccountInfoParsed, deserializeKey, flattenKeyList, serializeKey } from '@app/common';
import { MirrorNodeClient } from './mirror-node.client';
import { CacheHelper } from '@app/common/transaction-signature/cache.helper';
import { PublicKey } from '@hashgraph/sdk';

const CACHE_STALE_THRESHOLD_MS = 10 * 1000; // 10 seconds
const RECLAIM_AFTER_MS = 2 * 60 * 1000; // 2 minutes
//TODO still need to be sure that i only store stringraw keys or whatever, they all have to be the same
//TODO the transaciton_cached_account was saivng a new row every refresh
//TODO cache cleanup didn't remove anything (not sure if it even went off)
//TODO BE SURE TO ADD MANUAL RESYNC OF MIRROR NODE TO UI
@Injectable()
export class AccountCacheService {
  private readonly logger = new Logger(AccountCacheService.name);
  private readonly cacheHelper: CacheHelper;

  constructor(
    private readonly mirrorNodeClient: MirrorNodeClient,
    private readonly dataSource: DataSource,
  ) {
    this.cacheHelper = new CacheHelper(dataSource);
  }

  /**
   * Refresh account data by fetching from the mirror network.
   * Used by cron jobs or when an explicit forced refresh is required.
   * Returns parsed account info when refreshed successfully, or null otherwise.
   */
  async refreshAccount(cached: CachedAccount): Promise<AccountInfoParsed | null> {
    const account = cached.account;
    const mirrorNetwork = cached.mirrorNetwork;

    // Try to claim the account for refresh
    const claimedAccount = await this.tryClaimAccountRefresh(account, mirrorNetwork);

    if (!claimedAccount.refreshToken) {
      this.logger.debug(`Account ${account} on ${mirrorNetwork} is already being refreshed`);

      if (this.hasCompleteData(claimedAccount)) {
        return this.parseCachedAccount(claimedAccount);
      }

      return null;
    }

    return this.performRefreshForClaimedAccount(claimedAccount);
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

    if (this.isFresh(cached) && this.hasCompleteData(cached)) {
      // Link to transaction even if using cache
      await this.linkTransactionToAccount(transaction.id, cached.id);
      return this.parseCachedAccount(cached);
    }

    // Cache is stale or doesn't exist - fetch new data
    this.logger.debug(`Fetching account ${account} from mirror node (cache ${cached ? 'stale' : 'missing'})`);

    // Try to claim the account for refresh, create the account row if none exists
    const claimedAccount = await this.tryClaimAccountRefresh(account, mirrorNetwork);

    if (!claimedAccount.refreshToken) {
      // Another process is refreshing - return cached data if available
      this.logger.debug(`Account ${account} on ${mirrorNetwork} is being refreshed by another process`);

      // Link to transaction if we have cached data
      await this.linkTransactionToAccount(transaction.id, claimedAccount.id);

      if (this.hasCompleteData(claimedAccount)) {
        return this.parseCachedAccount(claimedAccount);
      }

      // No cached data and someone else is refreshing
      // This should not normally happen; return null so caller can decide wait/retry.
      return null;
    }

    return this.performRefreshForClaimedAccount(claimedAccount, transaction.id);
  }

  /**
   * Claim refresh for a CachedAccount row. Reclaim period: 2 minutes.
   */
  private tryClaimAccountRefresh(
    account: string,
    mirrorNetwork: string,
  ): Promise<CachedAccount> {
    return this.cacheHelper.tryClaimRefresh(
      CachedAccount,
      { account, mirrorNetwork },
      RECLAIM_AFTER_MS,
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
      // Update lastCheckedAt and clear refresh token only
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
  ): Promise<AccountInfoParsed | null> {
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
        return this.parseCachedAccount(claimedAccount);
      }

      if (!accountData) {
        this.logger.warn(`Account ${account} not found on mirror network ${mirrorNetwork}`);
        return null;
      }

      return accountData;
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
      'account',
    );
  }

  private insertAccountKeys(
    cachedAccountId: number,
    keys: PublicKey[],
  ): Promise<void> {
    return this.cacheHelper.insertKeys(
      CachedAccountKey,
      cachedAccountId,
      'account',
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
   * Return true when the cached row's lastCheckedAt is within the freshness threshold.
   */
  private isFresh(cached: CachedAccount | null): boolean {
    return cached?.lastCheckedAt &&
      (Date.now() - cached.lastCheckedAt.getTime()) < CACHE_STALE_THRESHOLD_MS;
  }

  /**
   * Check whether the cached account has the required persisted data (encoded key present).
   */
  private hasCompleteData(cached: CachedAccount | null): boolean {
    return !!(cached?.encodedKey);
  }
}
