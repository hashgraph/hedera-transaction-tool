import { DataSource, EntityTarget } from 'typeorm';
import { PublicKey } from '@hashgraph/sdk';
import { randomUUID } from 'node:crypto';
import { getUpsertRefreshTokenForCacheQuery, SqlBuilderService } from '../sql';

/**
 * Helper class for common caching operations.
 * Uses composition pattern - services delegate to this helper rather than inheriting from it.
 */
export class CacheHelper {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Generic claim-based refresh coordinator for any entity.
   *
   * Behavior:
   * 1) Ensures the row exists via idempotent insert-or-ignore.
   * 2) Attempts to atomically claim the row by setting a refresh token
   *    if it is unclaimed or reclaimable.
   * 3) If the claim succeeds, returns the claimed row (this caller is the refresher).
   * 4) If another caller is refreshing, waits until the refresh completes
   *    (refreshToken is cleared) or the reclaim window expires, then retries.
   *
   * Guarantees:
   * - At most one caller holds the refresh claim at any time.
   * - Waiting callers do not perform redundant refresh work.
   * - If a refresher stalls past the reclaim window, exactly one waiting
   *   caller will take over the claim.
   *
   * Freshness is enforced by the caller; this method coordinates ownership only.
   */
  async tryClaimRefresh<T extends { refreshToken?: string | null; updatedAt?: Date }>(
    sqlBuilder: SqlBuilderService,
    entity: EntityTarget<T>,
    where: Record<string, any>,
    reclaimAfterMs: number,
  ): Promise<T> {
    const pollIntervalMs = 100;
    const uuid = randomUUID();

    //TODO maybe just pass in teh full where and stuff, let it return teh values like th other?
    //either way, using 'where' like this is not super safe
    const sql = getUpsertRefreshTokenForCacheQuery(
      sqlBuilder,
      entity,
      Object.keys(where),
    );

    const maxAttempts = 100
    let attempt = 0;

    // Try to claim the cache row with optimistic locking.
    // Loop until we own it or hit max attempts.
    while (attempt < maxAttempts) {
      if (attempt > 0) {
        // On retry: check if row exists and is unclaimed (no refreshToken)
        const existing = await this.dataSource.manager.findOne(entity, { where }) as T | null;
        if (existing) {
          if (!existing.refreshToken) {
            // Unclaimed row found → we can use it (someone else finished updating)
            return existing;
          } else {
            // Still claimed by someone → wait and retry
            await new Promise(res => setTimeout(res, pollIntervalMs));
            attempt++;
            continue;
          }
        }
      }

      // Try atomic claim via custom UPSERT SQL
      const result = await this.dataSource.query(sql, [
        ...Object.values(where),        // key columns
        uuid,                           // our refreshToken
        new Date(Date.now() - reclaimAfterMs), // reclaim cutoff
      ]);

      if (!Array.isArray(result) || result.length !== 1) {
        throw new Error('Unexpected number of rows returned from cache upsert/claim');
      }

      const claim = result[0] as T;

      if (claim.refreshToken === uuid) {
        // SUCCESS: we claimed ownership
        return claim;
      } else {
        // FAILED: someone else claimed it first → wait and retry
        await new Promise(res => setTimeout(res, pollIntervalMs));
        attempt++;
      }
    }





    // const values = {
    //   ...where,
    //   createdAt: () => 'NOW()',
    //   updatedAt: () => 'NOW()',
    // };

    // const callId = randomUUID(); // unique id for this call
    // // 1. Ensure row exists (idempotent)
    // try {
    //   console.log(`[tryClaimRefresh] before insert ${callId}`);
    //
    //   await this.dataSource
    //     .createQueryBuilder()
    //     .insert()
    //     .into(entity)
    //     .values(where)
    //     .orIgnore()
    //     .execute();
    //
    //   console.log(`[tryClaimRefresh] after insert ${callId}`);
    // } catch (err) {
    //   console.error('[tryClaimRefresh] error ensuring cache row exists', { callId, err });
    //   throw err;
    // }
    //
    // let count = 0;
    // while (true) {
    //   count++;
    //   const reclaimDate = new Date(Date.now() - reclaimAfterMs);
    //
    //   console.log(`[tryClaimRefresh] loop count ${count} for ${callId}`);
    //   // 2. Try to claim (MUST update updatedAt)
    //   const updateResult = await this.dataSource
    //     .createQueryBuilder()
    //     .update(entity)
    //     .set({
    //       refreshToken: uuid,
    //       updatedAt: () => 'NOW()',
    //     })
    //     .where(where)
    //     .andWhere(
    //       `(refreshToken IS NULL OR updatedAt < :reclaimDate)`,
    //       { reclaimDate },
    //     )
    //     .returning('*')
    //     .execute();
    //
    //   // 3. We won the claim
    //   if (updateResult.affected === 1) {
    //     console.log(`[tryClaimRefresh] row updated ${callId}`);
    //     return updateResult.raw[0] as T;
    //   }
    //
    //   // 4. Someone else owns it → wait
    //   await new Promise(res => setTimeout(res, pollIntervalMs));
    //
    //   console.log(`[tryClaimRefresh] after timeout ${callId}`);
    //   const row = await this.dataSource.manager.findOne(entity, { where });
    //
    //   if (!row) {
    //     console.log(`[tryClaimRefresh] row not found ${callId}`);
    //     // Should not happen, but be defensive
    //     continue;
    //   }
    //
    //   // 5. Refresh finished while we waited
    //   if (!row.refreshToken) {
    //     console.log(`[tryClaimRefresh] refreshToken is null ${callId}`);
    //     return row;
    //   }
    //
    //   console.log(`[tryClaimRefresh] looping ${callId}`);
    //   // 6. Otherwise: loop again
    //   // Eventually reclaimDate will pass and one waiter will win
    // }


















      // const values = {
      //   ...where,
      //   refreshToken,
      //   createdAt: () => 'NOW()',
      //   updatedAt: () => 'NOW()',
      // }
      //
      // const row = await this.dataSource
      //   .createQueryBuilder()
      //   .insert()
      //   .into(entity)
      //   .values({
      //     ...where,
      //     refreshToken: myToken,
      //     createdAt: () => 'NOW()',
      //     updatedAt: () => 'NOW()',
      //   })
      //   .orUpdate(
      //     ['refreshToken'],
      //     [...where],
      //   )
      //   .onConflict(`(${Object.keys(where).join(', ')}) DO UPDATE SET
      //     refreshToken = EXCLUDED.refreshToken,
      //     updatedAt = NOW()
      //     WHERE ${Object.keys(where).map(k => `${entityAlias}.${k} = EXCLUDED.${k}`).join(' AND ')}
      //       AND (refreshToken IS NULL OR updatedAt < :reclaimDate)
      //   `)
      //   .setParameter('reclaimDate', reclaimDate)
      //   .returning('*')
      //   .execute();


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