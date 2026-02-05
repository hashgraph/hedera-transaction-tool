import { MigrationInterface, QueryRunner } from "typeorm";

export class CachedNodeAccountIdNullable1770193855293 implements MigrationInterface {
    name = 'CachedNodeAccountIdNullable1770193855293'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Allow NULLs
        await queryRunner.query(`ALTER TABLE "cached_node" ALTER COLUMN "nodeAccountId" DROP NOT NULL`);

        // Normalize existing empty strings to NULL
        await queryRunner.query(
          `UPDATE "cached_node" SET "nodeAccountId" = NULL WHERE "nodeAccountId" = ''`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Replace NULLs with empty string before enforcing NOT NULL
        await queryRunner.query(
          `UPDATE "cached_node" SET "nodeAccountId" = '' WHERE "nodeAccountId" IS NULL`,
        );

        // Disallow NULLs again
        await queryRunner.query(`ALTER TABLE "cached_node" ALTER COLUMN "nodeAccountId" SET NOT NULL`);
    }

}
