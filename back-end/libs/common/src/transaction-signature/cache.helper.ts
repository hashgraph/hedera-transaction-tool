import { DataSource, EntityTarget, FindOptionsWhere } from 'typeorm';
import { PublicKey } from '@hashgraph/sdk';
import { randomUUID } from 'node:crypto';
import { CacheKey, getUpsertRefreshTokenForCacheQuery, SqlBuilderService } from '../sql';

/**
 * Helper class for common caching operations.
 * Uses composition pattern - services delegate to this helper rather than inheriting from it.
 */
export class CacheHelper {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Generic claim-based refresh coordinator for cache rows.
   *
   * Behavior:
   * 1) Tries atomic UPSERT to claim row with unique refresh token
   *    - INSERT succeeds if row doesn't exist
   *    - UPDATE succeeds only if unclaimed (refreshToken IS NULL) or reclaimable (updatedAt < reclaim cutoff)
   * 2) Returns claimed row + `claimed: true` if this caller owns it
   * 3) If claim fails (another process owns it), polls with backoff until:
   *    - Row becomes unclaimed (use without claiming), OR
   *    - We successfully reclaim after maxAttempts
   *
   * Guarantees:
   * - Exactly one caller owns refreshToken at any time (optimistic locking)
   * - Polling callers avoid redundant work while waiting for current owner
   * - Stalled refresher can be reclaimed after `reclaimAfterMs` window
   * - Always returns valid row data (newly claimed or existing)
   *
   * Freshness is enforced by the caller; this method coordinates ownership only.
   *
   * @param sqlBuilder - Resolves safe table/column names from entity metadata
   * @param entity - TypeORM entity class (determines table/columns)
   * @param key - Unique key columns/values (determines conflict target)
   * @param reclaimAfterMs - Time window after which stale claims can be stolen
   * @returns Row data + boolean indicating if this caller claimed ownership
   * @throws If no row exists after max attempts or query fails unexpectedly
   */
  async tryClaimRefresh<T extends { refreshToken?: string | null; updatedAt?: Date }>(
    sqlBuilder: SqlBuilderService,
    entity: EntityTarget<T>,
    key: CacheKey,
    reclaimAfterMs: number,
  ): Promise<{ data: T, claimed: boolean }> {
    const pollIntervalMs = 500;
    const uuid = randomUUID();

    // Generate parameterized UPSERT SQL using safe column/table names from entity metadata
    // CacheKey defines conflict target columns
    const { text: sql, values } = getUpsertRefreshTokenForCacheQuery(
      sqlBuilder,
      entity,
      key,
    );

    const maxAttempts = 20;
    let attempt = 0;
    let existing: T | null = null;

    // Retry loop: claim atomically or poll for unclaimed row
    while (attempt < maxAttempts) {
      if (attempt > 0) {
        // On retries: check for unclaimed row to short-circuit without claiming
        existing = await this.dataSource.manager.findOne(entity, { where: key as unknown as FindOptionsWhere<T> }) as T | null;
        if (existing && !existing.refreshToken) {
          // Unclaimed row found → we can use it (someone else finished updating)
          return { data: existing, claimed: false };
        }
      }

      // Attempt atomic claim via UPSERT:
      // - INSERT new row with our claimToken
      // - ON CONFLICT: steal if unclaimed or reclaimable (updatedAt < reclaim cutoff)
      // - Always returns current owner row
      const result = await this.dataSource.query(sql, [
        ...values,                      // key columns
        uuid,                           // our refreshToken
        new Date(Date.now() - reclaimAfterMs), // reclaim cutoff
      ]);

      // Safety check: ensure query returns exactly one row (protects against SQL errors)
      if (!Array.isArray(result) || result.length !== 1) {
        throw new Error('Unexpected number of rows returned from cache upsert/claim');
      }

      const claim = result[0] as T;

      if (claim.refreshToken === uuid) {
        // SUCCESS: we claimed ownership
        return { data: claim, claimed: true };
      }

      // FAILED: someone else claimed it first → wait and retry
      await new Promise(res => setTimeout(res, pollIntervalMs));
      attempt++;
    }

    // Max attempts exhausted
    if (existing === null) {
      throw new Error('Failed to claim cache refresh after max attempts, and no existing data found');
    }

    // Return last known data (best effort)
    return { data: existing!, claimed: false };
  }

  /**
   * Save data and release refresh claim.
   * Returns the entity ID if successful, null if claim was lost.
   */
  async saveAndReleaseClaim<T>(
    entity: EntityTarget<T>,
    where: Record<string, any>,
    refreshToken: string,
    updates: Record<string, any>,
  ): Promise<number | null> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(entity)
      .set({
        ...updates,
        refreshToken: null, // release claim
        updatedAt: () => 'NOW()',
      })
      .where(where)
      .andWhere('refreshToken = :refreshToken', { refreshToken })
      .returning(['id'])
      .execute();

    if (result.affected !== 1) {
      return null; // Claim lost
    }

    return result.raw[0].id;
  }

  /**
   * Insert keys for a cached entity (idempotent).
   */
  async insertKeys(
    keyEntity: EntityTarget<any>,
    parentId: number,
    parentFieldName: string,
    keys: PublicKey[],
  ): Promise<void> {
    if (keys.length === 0) return;

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(keyEntity)
      .values(
        keys.map((key) => ({
          [parentFieldName]: { id: parentId },
          publicKey: key.toStringRaw(),
        })),
      )
      .orIgnore()
      .execute();
  }

  /**
   * Link a transaction to a cached entity (idempotent).
   */
  async linkTransactionToEntity(
    linkEntity: EntityTarget<any>,
    transactionId: number,
    entityId: number,
    entityFieldName: string,
  ): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(linkEntity)
      .values({
        transaction: { id: transactionId },
        [entityFieldName]: { id: entityId },
      })
      .orIgnore()
      .execute();
  }
}