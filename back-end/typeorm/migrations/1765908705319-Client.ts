import { MigrationInterface, QueryRunner } from "typeorm";

export class Client1765908705319 implements MigrationInterface {
    name = 'Client1765908705319'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "client" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "version" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_96da49381769303a6515a8785c7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ad3b4bf8dd18a1d467c5c0fc13" ON "client" ("userId") `);
        await queryRunner.query(`ALTER TABLE "client" ADD CONSTRAINT "FK_ad3b4bf8dd18a1d467c5c0fc13a" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "client" DROP CONSTRAINT "FK_ad3b4bf8dd18a1d467c5c0fc13a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad3b4bf8dd18a1d467c5c0fc13"`);
        await queryRunner.query(`DROP TABLE "client"`);
    }

}
