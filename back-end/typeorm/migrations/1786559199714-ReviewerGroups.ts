import { MigrationInterface, QueryRunner } from "typeorm";

export class ReviewerGroups1786559199714 implements MigrationInterface {
    name = 'ReviewerGroups1786559199714'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reviewer_group_member" ("id" SERIAL NOT NULL, "groupId" integer NOT NULL, "userId" integer NOT NULL, "userKeyId" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_d8c98d8d6f601ad45a3787a0724" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7f34ee6ee8a64749e3d64e3b54" ON "reviewer_group_member" ("groupId", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_799adc7c637e4680d6af1228aa" ON "reviewer_group_member" ("userId") `);
        await queryRunner.query(`CREATE TABLE "rule_change_record" ("id" SERIAL NOT NULL, "ruleId" integer, "groupId" integer, "action" character varying NOT NULL, "rulePayload" jsonb NOT NULL, "groupSnapshotVersion" integer, "attestationSignatures" bytea, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3cbbd11fcf1c8e23b395809748b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7db18ddbb3756ace9929e0b777" ON "rule_change_record" ("ruleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b671f04c5d6734ceac4efd1c1c" ON "rule_change_record" ("groupId") `);
        await queryRunner.query(`CREATE TABLE "reviewer_rule" ("id" SERIAL NOT NULL, "groupId" integer NOT NULL, "hederaEntityId" character varying NOT NULL, "network" character varying NOT NULL, "entityRole" character varying, "transactionType" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6d609736c6515dbd48a2d7a8e57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_reviewer_rule_entity_network_group_role_type" ON "reviewer_rule" ("hederaEntityId", "network", "groupId", COALESCE("entityRole", ''), COALESCE("transactionType", ''))`);
        await queryRunner.query(`CREATE INDEX "IDX_05941ea65e775091b6151f0e82" ON "reviewer_rule" ("groupId") `);
        await queryRunner.query(`CREATE TABLE "group_change_record" ("id" SERIAL NOT NULL, "groupId" integer, "snapshotVersion" integer NOT NULL, "snapshotPayload" jsonb NOT NULL, "attestationSignatures" bytea NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_af3eade3089345c6cd5076837b5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f78e60ef232789ac6aa1c06607" ON "group_change_record" ("groupId") `);
        await queryRunner.query(`CREATE TABLE "reviewer_group" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, "threshold" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_87ee58f90b87a196b5af6821cb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "transaction_entity" ("id" SERIAL NOT NULL, "transactionId" integer NOT NULL, "hederaEntityId" character varying NOT NULL, "network" character varying NOT NULL, "entityRole" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6f9d7f02d8835ac9ef1f685a2e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8ef3b2da37a9f6598574961425" ON "transaction_entity" ("transactionId", "hederaEntityId", "network", "entityRole") `);
        await queryRunner.query(`CREATE INDEX "IDX_db9d759ea4fd4630fd714f2b12" ON "transaction_entity" ("hederaEntityId", "network") `);
        await queryRunner.query(`CREATE TABLE "transaction_reviewer_list_member" ("id" SERIAL NOT NULL, "listId" integer NOT NULL, "userId" integer NOT NULL, "userKeyId" integer, "signature" bytea, "accepted" boolean, "note" character varying, "actionedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a4c103d9b8f074f7440bae89301" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bfed96717be0a37772b42d007b" ON "transaction_reviewer_list_member" ("listId", "userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_53976eecc9374e214d68e2ccd3" ON "transaction_reviewer_list_member" ("userId") `);
        await queryRunner.query(`CREATE TABLE "transaction_reviewer_list" ("id" SERIAL NOT NULL, "transactionId" integer NOT NULL, "name" character varying, "description" character varying, "threshold" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1ce3c0b59c4f486401f5551d041" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "reviewer_group_member" ADD CONSTRAINT "FK_e076a0934ba0498ef938251d8b6" FOREIGN KEY ("groupId") REFERENCES "reviewer_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviewer_group_member" ADD CONSTRAINT "FK_799adc7c637e4680d6af1228aad" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviewer_group_member" ADD CONSTRAINT "FK_052533b3b6215b80d8c2d705574" FOREIGN KEY ("userKeyId") REFERENCES "user_key"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rule_change_record" ADD CONSTRAINT "FK_7db18ddbb3756ace9929e0b777e" FOREIGN KEY ("ruleId") REFERENCES "reviewer_rule"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rule_change_record" ADD CONSTRAINT "FK_b671f04c5d6734ceac4efd1c1c5" FOREIGN KEY ("groupId") REFERENCES "reviewer_group"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviewer_rule" ADD CONSTRAINT "FK_05941ea65e775091b6151f0e820" FOREIGN KEY ("groupId") REFERENCES "reviewer_group"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_change_record" ADD CONSTRAINT "FK_f78e60ef232789ac6aa1c06607a" FOREIGN KEY ("groupId") REFERENCES "reviewer_group"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_entity" ADD CONSTRAINT "FK_3586b024b673dad2e0e3bd4f20d" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_reviewer_list_member" ADD CONSTRAINT "FK_c571ff75ef44a859c9f22219178" FOREIGN KEY ("listId") REFERENCES "transaction_reviewer_list"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_reviewer_list_member" ADD CONSTRAINT "FK_53976eecc9374e214d68e2ccd38" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_reviewer_list_member" ADD CONSTRAINT "FK_ef0ea996775ee298e4f0ae9ed48" FOREIGN KEY ("userKeyId") REFERENCES "user_key"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "IDX_911d4670973d1b76ff90e7a0d2" ON "transaction_reviewer_list" ("transactionId") `);
        await queryRunner.query(`ALTER TABLE "transaction_reviewer_list" ADD CONSTRAINT "FK_911d4670973d1b76ff90e7a0d26" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_reviewer_list" DROP CONSTRAINT "FK_911d4670973d1b76ff90e7a0d26"`);
        await queryRunner.query(`ALTER TABLE "transaction_reviewer_list_member" DROP CONSTRAINT "FK_ef0ea996775ee298e4f0ae9ed48"`);
        await queryRunner.query(`ALTER TABLE "transaction_reviewer_list_member" DROP CONSTRAINT "FK_53976eecc9374e214d68e2ccd38"`);
        await queryRunner.query(`ALTER TABLE "transaction_reviewer_list_member" DROP CONSTRAINT "FK_c571ff75ef44a859c9f22219178"`);
        await queryRunner.query(`ALTER TABLE "transaction_entity" DROP CONSTRAINT "FK_3586b024b673dad2e0e3bd4f20d"`);
        await queryRunner.query(`ALTER TABLE "group_change_record" DROP CONSTRAINT "FK_f78e60ef232789ac6aa1c06607a"`);
        await queryRunner.query(`ALTER TABLE "reviewer_rule" DROP CONSTRAINT "FK_05941ea65e775091b6151f0e820"`);
        await queryRunner.query(`ALTER TABLE "rule_change_record" DROP CONSTRAINT "FK_b671f04c5d6734ceac4efd1c1c5"`);
        await queryRunner.query(`ALTER TABLE "rule_change_record" DROP CONSTRAINT "FK_7db18ddbb3756ace9929e0b777e"`);
        await queryRunner.query(`ALTER TABLE "reviewer_group_member" DROP CONSTRAINT "FK_052533b3b6215b80d8c2d705574"`);
        await queryRunner.query(`ALTER TABLE "reviewer_group_member" DROP CONSTRAINT "FK_799adc7c637e4680d6af1228aad"`);
        await queryRunner.query(`ALTER TABLE "reviewer_group_member" DROP CONSTRAINT "FK_e076a0934ba0498ef938251d8b6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_911d4670973d1b76ff90e7a0d2"`);
        await queryRunner.query(`DROP TABLE "transaction_reviewer_list"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_53976eecc9374e214d68e2ccd3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bfed96717be0a37772b42d007b"`);
        await queryRunner.query(`DROP TABLE "transaction_reviewer_list_member"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db9d759ea4fd4630fd714f2b12"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ef3b2da37a9f6598574961425"`);
        await queryRunner.query(`DROP TABLE "transaction_entity"`);
        await queryRunner.query(`DROP TABLE "reviewer_group"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f78e60ef232789ac6aa1c06607"`);
        await queryRunner.query(`DROP TABLE "group_change_record"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_05941ea65e775091b6151f0e82"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_reviewer_rule_entity_network_group_role_type"`);
        await queryRunner.query(`DROP TABLE "reviewer_rule"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b671f04c5d6734ceac4efd1c1c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7db18ddbb3756ace9929e0b777"`);
        await queryRunner.query(`DROP TABLE "rule_change_record"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_799adc7c637e4680d6af1228aa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f34ee6ee8a64749e3d64e3b54"`);
        await queryRunner.query(`DROP TABLE "reviewer_group_member"`);
    }

}
