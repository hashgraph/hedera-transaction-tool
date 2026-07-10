import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransactionGroupDescriptionMaxLength1783680807000 implements MigrationInterface {
  name = 'TransactionGroupDescriptionMaxLength1783680807000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_group" ALTER COLUMN "description" TYPE character varying(256)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_group" ALTER COLUMN "description" TYPE character varying`,
    );
  }
}
