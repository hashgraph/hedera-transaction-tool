import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionCachedAccountIsReceiver1772727369385 implements MigrationInterface {
    name = 'TransactionCachedAccountIsReceiver1772727369385'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" ADD "isReceiver" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" DROP COLUMN "isReceiver"`);
    }

}
