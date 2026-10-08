import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReviewerGroupNameAndDescriptionMaxLength1790705154000 implements MigrationInterface {
  name = 'ReviewerGroupNameAndDescriptionMaxLength1790705154000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Postgres does not error when narrowing an unconstrained varchar column via ALTER
    // COLUMN TYPE — it silently truncates any row longer than the new limit. Since these
    // values are also recorded in attested snapshots elsewhere, a silent truncation here
    // would leave the live row diverging from what was actually attested. Fail loudly
    // instead so any oversized rows can be resolved before narrowing the columns.
    const [{ count }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "reviewer_group" WHERE length("name") > 75 OR length("description") > 150`,
    );
    if (count > 0) {
      throw new Error(
        `ReviewerGroupNameAndDescriptionMaxLength: ${count} reviewer_group row(s) exceed the ` +
          `new name(75)/description(150) limits. Resolve or archive the offending rows before ` +
          `re-running this migration — narrowing the columns would otherwise silently truncate them.`,
      );
    }

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
