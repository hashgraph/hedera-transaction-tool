import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransactionCommentMessageMaxLength1784625969022 implements MigrationInterface {
  name = 'TransactionCommentMessageMaxLength1784625969022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_comment" ALTER COLUMN "message" TYPE character varying(2000)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_comment" ALTER COLUMN "message" TYPE character varying`,
    );
  }
}
