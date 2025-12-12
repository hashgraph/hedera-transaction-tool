import { MigrationInterface, QueryRunner } from "typeorm";

export class MirrorNodeCaches1765268917785 implements MigrationInterface {
    name = 'MirrorNodeCaches1765268917785'

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
        await queryRunner.query(`CREATE TABLE "transaction_account" ("id" SERIAL NOT NULL, "transactionId" integer, "accountId" integer, CONSTRAINT "PK_e2652fa8c16723c83a00fb9b17e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6abb77ad1da87b525f150886cc" ON "transaction_account" ("transactionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_13050e67a02735c70c70462314" ON "transaction_account" ("accountId") `);
        await queryRunner.query(`CREATE TABLE "transaction_node" ("id" SERIAL NOT NULL, "transactionId" integer, "nodeId" integer, CONSTRAINT "PK_61f2afb651a49b687709ceb9bae" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d5d09706ba6e7503228daaaafb" ON "transaction_node" ("transactionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_32efb1a0fb184162d6dd30d71e" ON "transaction_node" ("nodeId") `);
        await queryRunner.query(`ALTER TABLE "cached_account_key" ADD CONSTRAINT "FK_6b47de5c8e68b4a72842efbdb5d" FOREIGN KEY ("accountId") REFERENCES "cached_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" ADD CONSTRAINT "FK_8dc5f197e332408f0f36ae6bb09" FOREIGN KEY ("nodeId") REFERENCES "cached_node"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_account" ADD CONSTRAINT "FK_6abb77ad1da87b525f150886cca" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_account" ADD CONSTRAINT "FK_13050e67a02735c70c70462314e" FOREIGN KEY ("accountId") REFERENCES "cached_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_node" ADD CONSTRAINT "FK_d5d09706ba6e7503228daaaafbf" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_node" ADD CONSTRAINT "FK_32efb1a0fb184162d6dd30d71e1" FOREIGN KEY ("nodeId") REFERENCES "cached_node"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_node" DROP CONSTRAINT "FK_32efb1a0fb184162d6dd30d71e1"`);
        await queryRunner.query(`ALTER TABLE "transaction_node" DROP CONSTRAINT "FK_d5d09706ba6e7503228daaaafbf"`);
        await queryRunner.query(`ALTER TABLE "transaction_account" DROP CONSTRAINT "FK_13050e67a02735c70c70462314e"`);
        await queryRunner.query(`ALTER TABLE "transaction_account" DROP CONSTRAINT "FK_6abb77ad1da87b525f150886cca"`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" DROP CONSTRAINT "FK_8dc5f197e332408f0f36ae6bb09"`);
        await queryRunner.query(`ALTER TABLE "cached_account_key" DROP CONSTRAINT "FK_6b47de5c8e68b4a72842efbdb5d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_32efb1a0fb184162d6dd30d71e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d5d09706ba6e7503228daaaafb"`);
        await queryRunner.query(`DROP TABLE "transaction_node"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_13050e67a02735c70c70462314"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6abb77ad1da87b525f150886cc"`);
        await queryRunner.query(`DROP TABLE "transaction_account"`);
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
