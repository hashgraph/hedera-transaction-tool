import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Support for keyless accounts (e.g. hollow accounts).
 *
 * - Keyless accounts were cached with encodedKey = [], which pg serializes as the two
 *   bytes "{}" (0x7b7d). Those cannot be protobuf-decoded; reset them to NULL.
 * - account_snapshot.encodedKey must allow NULL for keyless accounts.
 * - keyHash is dropped from both snapshot tables; change detection now compares encodedKey.
 */
export class KeylessAccountSupport1792600000000 implements MigrationInterface {
  name = 'KeylessAccountSupport1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "cached_account" SET "encodedKey" = NULL, "etag" = NULL WHERE "encodedKey" = '\\x7b7d'`,
    );
    await queryRunner.query(`ALTER TABLE "account_snapshot" ALTER COLUMN "encodedKey" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "account_snapshot" DROP COLUMN "keyHash"`);
    await queryRunner.query(`ALTER TABLE "node_snapshot" DROP COLUMN "keyHash"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Data is not touched on the way down:
    // - cached_account: the invalid "{}" values are not restored.
    // - account_snapshot.encodedKey stays nullable; keyless snapshots have no key to restore
    //   and no honest placeholder value.
    // Only the dropped columns are re-added (nullable, not backfilled).
    await queryRunner.query(`ALTER TABLE "account_snapshot" ADD "keyHash" character varying(64)`);
    await queryRunner.query(`ALTER TABLE "node_snapshot" ADD "keyHash" character varying(64)`);
  }
}
