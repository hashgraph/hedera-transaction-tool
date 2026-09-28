import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionSnapshotJoiners1782115200000 implements MigrationInterface {
    name = 'TransactionSnapshotJoiners1782115200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "transaction_account_snapshot" (
                "id"                SERIAL NOT NULL,
                "transactionId"     integer NOT NULL,
                "accountSnapshotId" integer NOT NULL,
                "isReceiver"        boolean NOT NULL DEFAULT false,
                CONSTRAINT "PK_transaction_account_snapshot" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_27c882001e723d0c3153609e32"
            ON "transaction_account_snapshot" ("transactionId", "accountSnapshotId")
        `);

        await queryRunner.query(`
            ALTER TABLE "transaction_account_snapshot"
            ADD CONSTRAINT "FK_050aec9d0c27697ee2416c5424b"
            FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "transaction_account_snapshot"
            ADD CONSTRAINT "FK_3b13535614dd3373c94537d92a3"
            FOREIGN KEY ("accountSnapshotId") REFERENCES "account_snapshot"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            CREATE TABLE "transaction_node_snapshot" (
                "id"             SERIAL NOT NULL,
                "transactionId"  integer NOT NULL,
                "nodeSnapshotId" integer NOT NULL,
                CONSTRAINT "PK_transaction_node_snapshot" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_478363b3d5b20956e8e1dad399"
            ON "transaction_node_snapshot" ("transactionId", "nodeSnapshotId")
        `);

        await queryRunner.query(`
            ALTER TABLE "transaction_node_snapshot"
            ADD CONSTRAINT "FK_4fb8af3d0416e3005a2fd4e7e71"
            FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "transaction_node_snapshot"
            ADD CONSTRAINT "FK_6d2f3cde2e929f91143a133ef2f"
            FOREIGN KEY ("nodeSnapshotId") REFERENCES "node_snapshot"("id") ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_node_snapshot" DROP CONSTRAINT "FK_6d2f3cde2e929f91143a133ef2f"`);
        await queryRunner.query(`ALTER TABLE "transaction_node_snapshot" DROP CONSTRAINT "FK_4fb8af3d0416e3005a2fd4e7e71"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_478363b3d5b20956e8e1dad399"`);
        await queryRunner.query(`DROP TABLE "transaction_node_snapshot"`);

        await queryRunner.query(`ALTER TABLE "transaction_account_snapshot" DROP CONSTRAINT "FK_3b13535614dd3373c94537d92a3"`);
        await queryRunner.query(`ALTER TABLE "transaction_account_snapshot" DROP CONSTRAINT "FK_050aec9d0c27697ee2416c5424b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_27c882001e723d0c3153609e32"`);
        await queryRunner.query(`DROP TABLE "transaction_account_snapshot"`);
    }
}
