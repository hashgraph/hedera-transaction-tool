import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserKeyActivePublicKeyUnique1792500000000 implements MigrationInterface {
  name = 'UserKeyActivePublicKeyUnique1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fail on existing active duplicates: ownership cannot safely be inferred.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_key_active_public_key" ON "user_key" ("publicKey") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_user_key_active_public_key"`);
  }
}
