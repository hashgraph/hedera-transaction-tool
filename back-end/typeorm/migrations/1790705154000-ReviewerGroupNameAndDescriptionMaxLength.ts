import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReviewerGroupNameAndDescriptionMaxLength1790705154000 implements MigrationInterface {
  name = 'ReviewerGroupNameAndDescriptionMaxLength1790705154000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviewer_group" ALTER COLUMN "name" TYPE character varying(75)`);
    await queryRunner.query(
      `ALTER TABLE "reviewer_group" ALTER COLUMN "description" TYPE character varying(150)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "reviewer_group" ALTER COLUMN "name" TYPE character varying`);
    await queryRunner.query(
      `ALTER TABLE "reviewer_group" ALTER COLUMN "description" TYPE character varying`,
    );
  }
}
