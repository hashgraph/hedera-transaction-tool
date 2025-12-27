import { DataSource, EntityTarget } from 'typeorm';
import { PublicKey } from '@hashgraph/sdk';

/**
 * Helper class for common caching operations.
 * Uses composition pattern - services delegate to this helper rather than inheriting from it.
 */
export class CacheHelper {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Generic claim-based refresh pattern for any entity.
   *
   * 1) Idempotent insert-or-ignore to ensure the row exists.
   * 2) Conditional update to set a refresh token only if unclaimed or reclaimable.
   * 3) Return the row that this caller now owns (or the current authoritative row).
   */
  async tryClaimRefresh<T>(
    entity: EntityTarget<T>,
    where: Record<string, any>,
    reclaimAfterMs: number,
  ): Promise<T> {
    const now = new Date();
    const reclaimDate = new Date(now.getTime() - reclaimAfterMs);

    // 1. Ensure row exists (idempotent insert)
    const insertResult = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(entity)
      .values(where)
      .orIgnore()
      .returning('*')
      .execute();

    // 2. Try to claim by setting a refresh token
    const updateResult = await this.dataSource
      .createQueryBuilder()
      .update(entity)
      .set({
        refreshToken: () => 'gen_random_uuid()',
      })
      .where(where)
      .andWhere(
        `(refreshToken IS NULL OR lastCheckedAt < :reclaimDate)`,
        { reclaimDate },
      )
      .returning('*')
      .execute();

    // 3. If we claimed it, return our claimed row
    if (updateResult.affected === 1) {
      return updateResult.raw[0] as T;
    }

    if (insertResult.raw.length > 0) {
      return insertResult.raw[0] as T;
    }

    // 4. Otherwise return the current authoritative row
    return await this.dataSource.manager.findOne(entity, { where });
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
    const now = new Date();

    const result = await this.dataSource
      .createQueryBuilder()
      .update(entity)
      .set({
        ...updates,
        lastCheckedAt: now,
        refreshToken: null, // release claim
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

  /**
   * Check if cached data is fresh based on threshold.
   */
  isFresh(lastCheckedAt: Date | null | undefined, thresholdMs: number): boolean {
    return (
      lastCheckedAt && Date.now() - lastCheckedAt.getTime() < thresholdMs
    );
  }
}