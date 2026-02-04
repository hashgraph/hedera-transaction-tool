import { MigrationInterface, QueryRunner } from "typeorm";

export class CachedNodeAccountIdNullable1770193855293 implements MigrationInterface {
    name = 'CachedNodeAccountIdNullable1770193855293'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cached_node" ALTER COLUMN "nodeAccountId" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cached_node" ALTER COLUMN "nodeAccountId" SET NOT NULL`);
    }

}
