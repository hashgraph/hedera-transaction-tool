import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropLegacyApproverTable1790000000000 implements MigrationInterface {
  name = 'DropLegacyApproverTable1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // CASCADE removes the table's foreign keys, indexes, and self-referential constraint.
    await queryRunner.query('DROP TABLE IF EXISTS "transaction_approver" CASCADE');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // The removed approver tree is obsolete and its data cannot be reconstructed.
  }
}
