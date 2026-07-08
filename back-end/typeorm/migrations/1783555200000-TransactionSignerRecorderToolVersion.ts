import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionSignerRecorderToolVersion1783555200000 implements MigrationInterface {
    name = 'TransactionSignerRecorderToolVersion1783555200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_signer" ADD "recorderId" integer`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" ADD "tool" character varying`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" ADD "version" character varying`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" ADD CONSTRAINT "FK_12e4f7f1cfff91745d83f9bd57f" FOREIGN KEY ("recorderId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP CONSTRAINT "FK_12e4f7f1cfff91745d83f9bd57f"`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP COLUMN "recorderId"`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP COLUMN "tool"`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP COLUMN "version"`);
    }
}
