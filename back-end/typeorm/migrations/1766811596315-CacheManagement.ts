import { MigrationInterface, QueryRunner } from "typeorm";

export class CacheManagement1766811596315 implements MigrationInterface {
    name = 'CacheManagement1766811596315'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cached_account" ADD "encodedKey" bytea`);
        await queryRunner.query(`ALTER TABLE "cached_account" ADD "lastCheckedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "cached_account" ADD "refreshToken" uuid`);
        await queryRunner.query(`ALTER TABLE "cached_node" ADD "nodeAccountId" character varying(64) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cached_node" ADD "encodedKey" bytea`);
        await queryRunner.query(`ALTER TABLE "cached_node" ADD "lastCheckedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "cached_node" ADD "refreshToken" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_58d28a30bbbd06a8defdf7069f" ON "cached_account" ("refreshToken") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dd83b9bbaa565876724587bceb" ON "cached_account_key" ("accountId", "publicKey") `);
        await queryRunner.query(`CREATE INDEX "IDX_31f16f181cd54481f662916edc" ON "cached_node" ("nodeAccountId") `);
        await queryRunner.query(`CREATE INDEX "IDX_861090c992cdce02c92248afbf" ON "cached_node" ("refreshToken") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0c5bf2f6cd932e86d5f38469ce" ON "cached_node_admin_key" ("nodeId", "publicKey") `);
        await queryRunner.renameTable('transaction_account', 'transaction_cached_account');
        await queryRunner.renameTable('transaction_node', 'transaction_cached_node');
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4c440b7f3bbb5a2c63719879f2" ON "transaction_cached_account" ("transactionId", "accountId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_63c239fd4ff264c1643b296676" ON "transaction_cached_node" ("transactionId", "nodeId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_0c5bf2f6cd932e86d5f38469ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_861090c992cdce02c92248afbf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_31f16f181cd54481f662916edc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dd83b9bbaa565876724587bceb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_58d28a30bbbd06a8defdf7069f"`);
        await queryRunner.query(`ALTER TABLE "cached_node" DROP COLUMN "refreshToken"`);
        await queryRunner.query(`ALTER TABLE "cached_node" DROP COLUMN "lastCheckedAt"`);
        await queryRunner.query(`ALTER TABLE "cached_node" DROP COLUMN "encodedKey"`);
        await queryRunner.query(`ALTER TABLE "cached_node" DROP COLUMN "nodeAccountId"`);
        await queryRunner.query(`ALTER TABLE "cached_account" DROP COLUMN "refreshToken"`);
        await queryRunner.query(`ALTER TABLE "cached_account" DROP COLUMN "lastCheckedAt"`);
        await queryRunner.query(`ALTER TABLE "cached_account" DROP COLUMN "encodedKey"`);
        await queryRunner.renameTable('transaction_cached_account', 'transaction_account');
        await queryRunner.renameTable('transaction_cached_node', 'transaction_node');
        await queryRunner.query(`DROP INDEX "public"."IDX_63c239fd4ff264c1643b296676"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c440b7f3bbb5a2c63719879f2"`);
    }

}
