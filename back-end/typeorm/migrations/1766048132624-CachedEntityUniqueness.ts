import { MigrationInterface, QueryRunner } from "typeorm";

export class CachedEntityUniqueness1766048132624 implements MigrationInterface {
    name = 'CachedEntityUniqueness1766048132624'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cached_account" ADD "mirrorNetwork" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cached_node" ADD "mirrorNetwork" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cached_account" DROP CONSTRAINT "UQ_bdcad9eb7867ce7948ff9b55fe4"`);
        await queryRunner.query(`ALTER TABLE "cached_node" DROP CONSTRAINT "UQ_d6d6c8709e4155e2f8a7022db47"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_3a019acfe47d25919ce088415e" ON "cached_account" ("account", "mirrorNetwork") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_261a092cc24fe5352cb51b298d" ON "cached_node" ("nodeId", "mirrorNetwork") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_261a092cc24fe5352cb51b298d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3a019acfe47d25919ce088415e"`);
        await queryRunner.query(`ALTER TABLE "cached_node" ADD CONSTRAINT "UQ_d6d6c8709e4155e2f8a7022db47" UNIQUE ("nodeId")`);
        await queryRunner.query(`ALTER TABLE "cached_account" ADD CONSTRAINT "UQ_bdcad9eb7867ce7948ff9b55fe4" UNIQUE ("account")`);
        await queryRunner.query(`ALTER TABLE "cached_node" DROP COLUMN "mirrorNetwork"`);
        await queryRunner.query(`ALTER TABLE "cached_account" DROP COLUMN "mirrorNetwork"`);
    }

}
