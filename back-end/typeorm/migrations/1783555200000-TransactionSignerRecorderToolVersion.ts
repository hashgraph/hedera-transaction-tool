import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionSignerRecorderToolVersion1783555200000 implements MigrationInterface {
    name = 'TransactionSignerRecorderToolVersion1783555200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_signer" ADD "recorderId" integer`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" ADD "tool" character varying`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" ADD "version" character varying`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" ADD CONSTRAINT "FK_transaction_signer_recorderId" FOREIGN KEY ("recorderId") REFERENCES "user"("id")`);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_signer_recorderId" ON "transaction_signer" ("recorderId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_signer_recorderId"`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP CONSTRAINT "FK_transaction_signer_recorderId"`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP COLUMN "recorderId"`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP COLUMN "tool"`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP COLUMN "version"`);
    }
}
