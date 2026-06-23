import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountKeyAndNodeAdminKeySnapshots1781481600000 implements MigrationInterface {
    name = 'AccountKeyAndNodeAdminKeySnapshots1781481600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "account_snapshot" (
                "id" SERIAL NOT NULL,
                "account" character varying(64) NOT NULL,
                "mirrorNetwork" character varying NOT NULL,
                "encodedKey" bytea NOT NULL,
                "keyHash" character varying(64) NOT NULL,
                "publicKeys" text array NOT NULL,
                "receiverSignatureRequired" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_account_snapshot" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_account_snapshot_lookup"
            ON "account_snapshot" ("account", "mirrorNetwork", "createdAt" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_account_snapshot_public_keys_gin"
            ON "account_snapshot" USING GIN ("publicKeys")
        `);

        await queryRunner.query(`
            CREATE TABLE "node_snapshot" (
                "id" SERIAL NOT NULL,
                "nodeId" integer NOT NULL,
                "mirrorNetwork" character varying NOT NULL,
                "encodedKey" bytea NOT NULL,
                "keyHash" character varying(64) NOT NULL,
                "publicKeys" text array NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_node_snapshot" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_node_snapshot_lookup"
            ON "node_snapshot" ("nodeId", "mirrorNetwork", "createdAt" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_node_snapshot_public_keys_gin"
            ON "node_snapshot" USING GIN ("publicKeys")
        `);

    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_node_snapshot_public_keys_gin"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_node_snapshot_lookup"`);
        await queryRunner.query(`DROP TABLE "node_snapshot"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_account_snapshot_public_keys_gin"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_account_snapshot_lookup"`);
        await queryRunner.query(`DROP TABLE "account_snapshot"`);
    }
}
