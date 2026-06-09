import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionNameLengthIncrease1780945073905 implements MigrationInterface {
    name = 'TransactionNameLengthIncrease1780945073905'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "name" TYPE character varying(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "name" TYPE character varying(50)`);
    }

}
