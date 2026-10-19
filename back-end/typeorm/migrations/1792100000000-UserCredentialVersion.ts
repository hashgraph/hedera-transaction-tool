import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserCredentialVersion1792100000000 implements MigrationInterface {
  name = 'UserCredentialVersion1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "credentialVersion" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "credentialVersion"`);
  }
}
