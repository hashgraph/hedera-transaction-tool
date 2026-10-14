import { MigrationInterface, QueryRunner } from "typeorm";

export class ApiKeys1791489850950 implements MigrationInterface {
    name = 'ApiKeys1791489850950'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "api_key" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "keyId" character varying NOT NULL, "secretHash" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP WITH TIME ZONE, "lastUsedIp" character varying, "revokedAt" TIMESTAMP WITH TIME ZONE, "revokedReason" character varying, CONSTRAINT "UQ_277972f4944205eb29127f9bb6c" UNIQUE ("userId"), CONSTRAINT "UQ_b0f723ede96b2991afe698988b6" UNIQUE ("keyId"), CONSTRAINT "REL_277972f4944205eb29127f9bb6" UNIQUE ("userId"), CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "api_key_event" ("id" SERIAL NOT NULL, "apiKeyId" integer, "userId" integer NOT NULL, "performedBy" integer, "eventType" character varying NOT NULL, "reason" character varying, "ipAddress" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_675a77f982c3f3dd9584b1e3c0e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a3eb973d969486ad9b094709ac" ON "api_key_event"  ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1626ada530196826b21d05bef3" ON "api_key_event"  ("apiKeyId") `);
        await queryRunner.query(`ALTER TABLE "user" ADD "canViewReports" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "api_key" ADD CONSTRAINT "FK_277972f4944205eb29127f9bb6c" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "api_key_event" ADD CONSTRAINT "FK_1626ada530196826b21d05bef3c" FOREIGN KEY ("apiKeyId") REFERENCES "api_key"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "api_key_event" ADD CONSTRAINT "FK_a3eb973d969486ad9b094709ac5" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "api_key_event" ADD CONSTRAINT "FK_eddfbc4e4c9520c40e3b26c748a" FOREIGN KEY ("performedBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "api_key_event" DROP CONSTRAINT "FK_eddfbc4e4c9520c40e3b26c748a"`);
        await queryRunner.query(`ALTER TABLE "api_key_event" DROP CONSTRAINT "FK_a3eb973d969486ad9b094709ac5"`);
        await queryRunner.query(`ALTER TABLE "api_key_event" DROP CONSTRAINT "FK_1626ada530196826b21d05bef3c"`);
        await queryRunner.query(`ALTER TABLE "api_key" DROP CONSTRAINT "FK_277972f4944205eb29127f9bb6c"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "canViewReports"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1626ada530196826b21d05bef3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a3eb973d969486ad9b094709ac"`);
        await queryRunner.query(`DROP TABLE "api_key_event"`);
        await queryRunner.query(`DROP TABLE "api_key"`);
    }

}
