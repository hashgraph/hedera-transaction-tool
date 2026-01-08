import { DataSource, EntityTarget } from 'typeorm';
import { PublicKey } from '@hashgraph/sdk';
import { randomUUID } from 'node:crypto';

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
    entity: EntityTarget<T>,
    where: Record<string, any>,
    reclaimAfterMs: number,
  ): Promise<T> {
    const pollIntervalMs = 100;
    const uuid = randomUUID();

    // 1. Ensure row exists (idempotent)
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(entity)
      .values(where)
      .orIgnore()
      .execute();

    while (true) {
      const reclaimDate = new Date(Date.now() - reclaimAfterMs);

      // 2. Try to claim (MUST update updatedAt)
      const updateResult = await this.dataSource
        .createQueryBuilder()
        .update(entity)
        .set({
          refreshToken: uuid,
          updatedAt: () => 'NOW()',
        })
        .where(where)
        .andWhere(
          `(refreshToken IS NULL OR updatedAt < :reclaimDate)`,
          { reclaimDate },
        )
        .returning('*')
        .execute();

      // 3. We won the claim
      if (updateResult.affected === 1) {
        return updateResult.raw[0] as T;
      }

      // 4. Someone else owns it → wait
      await new Promise(res => setTimeout(res, pollIntervalMs));

      const row = await this.dataSource.manager.findOne(entity, { where });

      if (!row) {
        // Should not happen, but be defensive
        continue;
      }

      // 5. Refresh finished while we waited
      if (!row.refreshToken) {
        return row;
      }

      // 6. Otherwise: loop again
      // Eventually reclaimDate will pass and one waiter will win
    }
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