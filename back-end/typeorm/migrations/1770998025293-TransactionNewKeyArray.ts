import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionNewKeyArray1770998025293 implements MigrationInterface {
    name = 'TransactionNewKeyArray1770998025293'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ADD "publicKeys" text array`);
        await queryRunner.query(`CREATE INDEX "idx_transaction_public_keys_gin" ON "transaction" USING GIN ("publicKeys")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_transaction_public_keys_gin"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "publicKeys"`);
    }

}
