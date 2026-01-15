import { MigrationInterface, QueryRunner } from 'typeorm';

export class SoftDeleteOrphanedUserKeys1768476506165 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Soft-delete all keys belonging to already soft-deleted users
    // This ensures data consistency for users that were deleted before
    // the cascade soft-delete logic was implemented
    await queryRunner.query(`
      UPDATE "user_key"
      SET "deletedAt" = u."deletedAt"
      FROM "user" u
      WHERE "user_key"."userId" = u.id
        AND u."deletedAt" IS NOT NULL
        AND "user_key"."deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore keys that were deleted by this migration
    // Note: This only works reliably if no keys were individually deleted
    // after the migration ran, as we match on deletedAt timestamps
    await queryRunner.query(`
      UPDATE "user_key"
      SET "deletedAt" = NULL
      FROM "user" u
      WHERE "user_key"."userId" = u.id
        AND u."deletedAt" IS NOT NULL
        AND "user_key"."deletedAt" = u."deletedAt"
    `);
  }
}
