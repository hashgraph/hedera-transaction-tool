import { MigrationInterface, QueryRunner } from "typeorm";

export class MirrorNodeCaches1765225236388 implements MigrationInterface {
    name = 'MirrorNodeCaches1765225236388'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cached_account" ("id" SERIAL NOT NULL, "account" character varying(64) NOT NULL, "receiverSignatureRequired" boolean, "etag" character varying(100), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_bdcad9eb7867ce7948ff9b55fe4" UNIQUE ("account"), CONSTRAINT "PK_81a72468bc99c7baad5aa4cc694" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bdcad9eb7867ce7948ff9b55fe" ON "cached_account" ("account") `);
        await queryRunner.query(`CREATE INDEX "IDX_ba7c51fa9c07743d7fae2fbf34" ON "cached_account" ("updatedAt") `);
        await queryRunner.query(`CREATE TABLE "cached_account_key" ("id" SERIAL NOT NULL, "publicKey" character varying(128) NOT NULL, "accountId" integer, CONSTRAINT "PK_ead6fb3bcf52a20c3e99b3e3819" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6b47de5c8e68b4a72842efbdb5" ON "cached_account_key" ("accountId") `);
        await queryRunner.query(`CREATE INDEX "IDX_26c992799f1689b9d11ed89c97" ON "cached_account_key" ("publicKey") `);
        await queryRunner.query(`CREATE TABLE "cached_node" ("id" SERIAL NOT NULL, "nodeId" integer NOT NULL, "etag" character varying(100), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d6d6c8709e4155e2f8a7022db47" UNIQUE ("nodeId"), CONSTRAINT "PK_eb1ccbcd7b44353893ec2291a1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d6d6c8709e4155e2f8a7022db4" ON "cached_node" ("nodeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_70bbb20a4e5bf8d0be4aa4a05a" ON "cached_node" ("updatedAt") `);
        await queryRunner.query(`CREATE TABLE "cached_node_admin_key" ("id" SERIAL NOT NULL, "publicKey" character varying(128) NOT NULL, "nodeId" integer, CONSTRAINT "PK_b097e5d1142c62b72e7bc2274db" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8dc5f197e332408f0f36ae6bb0" ON "cached_node_admin_key" ("nodeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d51e635eff3386df553e4e8dbb" ON "cached_node_admin_key" ("publicKey") `);
        await queryRunner.query(`CREATE TABLE "transaction_accounts" ("id" SERIAL NOT NULL, "transactionId" integer, "accountId" integer, CONSTRAINT "PK_a1cb6c9be93039243443bc42709" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_39b48ee86590fa5e263a0bffd7" ON "transaction_accounts" ("transactionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a5f4a2815c10b6d87062e1c6db" ON "transaction_accounts" ("accountId") `);
        await queryRunner.query(`CREATE TABLE "transaction_node" ("id" SERIAL NOT NULL, "transactionId" integer, "nodeId" integer, CONSTRAINT "PK_61f2afb651a49b687709ceb9bae" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d5d09706ba6e7503228daaaafb" ON "transaction_node" ("transactionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_32efb1a0fb184162d6dd30d71e" ON "transaction_node" ("nodeId") `);
        await queryRunner.query(`ALTER TABLE "cached_account_key" ADD CONSTRAINT "FK_6b47de5c8e68b4a72842efbdb5d" FOREIGN KEY ("accountId") REFERENCES "cached_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" ADD CONSTRAINT "FK_8dc5f197e332408f0f36ae6bb09" FOREIGN KEY ("nodeId") REFERENCES "cached_node"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_accounts" ADD CONSTRAINT "FK_39b48ee86590fa5e263a0bffd73" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_accounts" ADD CONSTRAINT "FK_a5f4a2815c10b6d87062e1c6dbe" FOREIGN KEY ("accountId") REFERENCES "cached_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_node" ADD CONSTRAINT "FK_d5d09706ba6e7503228daaaafbf" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_node" ADD CONSTRAINT "FK_32efb1a0fb184162d6dd30d71e1" FOREIGN KEY ("nodeId") REFERENCES "cached_node"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_node" DROP CONSTRAINT "FK_32efb1a0fb184162d6dd30d71e1"`);
        await queryRunner.query(`ALTER TABLE "transaction_node" DROP CONSTRAINT "FK_d5d09706ba6e7503228daaaafbf"`);
        await queryRunner.query(`ALTER TABLE "transaction_accounts" DROP CONSTRAINT "FK_a5f4a2815c10b6d87062e1c6dbe"`);
        await queryRunner.query(`ALTER TABLE "transaction_accounts" DROP CONSTRAINT "FK_39b48ee86590fa5e263a0bffd73"`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" DROP CONSTRAINT "FK_8dc5f197e332408f0f36ae6bb09"`);
        await queryRunner.query(`ALTER TABLE "cached_account_key" DROP CONSTRAINT "FK_6b47de5c8e68b4a72842efbdb5d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32efb1a0fb184162d6dd30d71e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d5d09706ba6e7503228daaaafb"`);
        await queryRunner.query(`DROP TABLE "transaction_node"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a5f4a2815c10b6d87062e1c6db"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_39b48ee86590fa5e263a0bffd7"`);
        await queryRunner.query(`DROP TABLE "transaction_accounts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d51e635eff3386df553e4e8dbb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8dc5f197e332408f0f36ae6bb0"`);
        await queryRunner.query(`DROP TABLE "cached_node_admin_key"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_70bbb20a4e5bf8d0be4aa4a05a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6d6c8709e4155e2f8a7022db4"`);
        await queryRunner.query(`DROP TABLE "cached_node"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_26c992799f1689b9d11ed89c97"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b47de5c8e68b4a72842efbdb5"`);
        await queryRunner.query(`DROP TABLE "cached_account_key"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ba7c51fa9c07743d7fae2fbf34"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bdcad9eb7867ce7948ff9b55fe"`);
        await queryRunner.query(`DROP TABLE "cached_account"`);
    }

}
