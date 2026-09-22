import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTransactionApprover1789494719604 implements MigrationInterface {
  name = 'DropTransactionApprover1789494719604';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dropping the table also removes its indexes and owned serial sequence.
    await queryRunner.query(`ALTER TABLE "transaction_approver" DROP CONSTRAINT "FK_f68cf6105a89f541285e9095f43"`);
    await queryRunner.query(`ALTER TABLE "transaction_approver" DROP CONSTRAINT "FK_20c31a39e8783b6e888ed9dee45"`);
    await queryRunner.query(`ALTER TABLE "transaction_approver" DROP CONSTRAINT "FK_78ab241fea906fe2fa317726311"`);
    await queryRunner.query(`ALTER TABLE "transaction_approver" DROP CONSTRAINT "FK_b5401848ee318619792d9ead127"`);
    await queryRunner.query(`DROP TABLE "transaction_approver"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "transaction_approver" ("id" SERIAL NOT NULL, "transactionId" integer, "listId" integer, "threshold" integer, "userKeyId" integer, "signature" bytea, "userId" integer, "approved" boolean, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_d6d9eeb7f5b3590e3a20888463e" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_b5401848ee318619792d9ead12" ON "transaction_approver" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_f68cf6105a89f541285e9095f4" ON "transaction_approver" ("transactionId")`);
    await queryRunner.query(`ALTER TABLE "transaction_approver" ADD CONSTRAINT "FK_f68cf6105a89f541285e9095f43" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "transaction_approver" ADD CONSTRAINT "FK_20c31a39e8783b6e888ed9dee45" FOREIGN KEY ("listId") REFERENCES "transaction_approver"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "transaction_approver" ADD CONSTRAINT "FK_78ab241fea906fe2fa317726311" FOREIGN KEY ("userKeyId") REFERENCES "user_key"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "transaction_approver" ADD CONSTRAINT "FK_b5401848ee318619792d9ead127" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
  }
}
