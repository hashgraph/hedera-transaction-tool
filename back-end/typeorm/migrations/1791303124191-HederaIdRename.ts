import { MigrationInterface, QueryRunner } from 'typeorm';

// Renames hederaEntityId to hederaId on both reviewer_rule and transaction_entity — the
// column holds either a Hedera entity ID or a node ID, so hederaEntityId implied
// entity-only. Also backfills transaction_entity: node ids were stored as "node:<id>" to
// disambiguate from entity ids, but entity ids are always shard.realm.num ("0.0.1234") and
// node ids are always a bare integer, so the prefix was never needed — the format itself
// disambiguates, same convention reviewer_rule already used.
export class HederaIdRename1791303124191 implements MigrationInterface {
  name = 'HederaIdRename1791303124191';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviewer_rule" RENAME COLUMN "hederaEntityId" TO "hederaId"`);

    await queryRunner.query(
      `UPDATE "transaction_entity" SET "hederaEntityId" = substring("hederaEntityId" from 6) WHERE "entityRole" = 'node' AND "hederaEntityId" LIKE 'node:%'`,
    );
    await queryRunner.query(`ALTER TABLE "transaction_entity" RENAME COLUMN "hederaEntityId" TO "hederaId"`);
    // Renaming the column doesn't rename TypeORM's auto-generated (hash-of-columns) index
    // names, so bring them in line with what the entity decorators now compute.
    await queryRunner.query(
      `ALTER INDEX "IDX_8ef3b2da37a9f6598574961425" RENAME TO "IDX_72cb662e529e70f92f027cb40d"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_db9d759ea4fd4630fd714f2b12" RENAME TO "IDX_34ccd5c47be7a49e153bffd430"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER INDEX "IDX_34ccd5c47be7a49e153bffd430" RENAME TO "IDX_db9d759ea4fd4630fd714f2b12"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_72cb662e529e70f92f027cb40d" RENAME TO "IDX_8ef3b2da37a9f6598574961425"`,
    );
    await queryRunner.query(`ALTER TABLE "transaction_entity" RENAME COLUMN "hederaId" TO "hederaEntityId"`);
    await queryRunner.query(
      `UPDATE "transaction_entity" SET "hederaEntityId" = 'node:' || "hederaEntityId" WHERE "entityRole" = 'node' AND "hederaEntityId" NOT LIKE 'node:%'`,
    );

    await queryRunner.query(`ALTER TABLE "reviewer_rule" RENAME COLUMN "hederaId" TO "hederaEntityId"`);
  }
}
