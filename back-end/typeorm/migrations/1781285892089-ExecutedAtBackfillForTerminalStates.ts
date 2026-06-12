import { MigrationInterface, QueryRunner } from "typeorm";

export class ExecutedAtBackfillForTerminalStates1781285892089 implements MigrationInterface {
    name = 'ExecutedAtBackfillForTerminalStates1781285892089'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "transaction"
            SET "executedAt" = "updatedAt"
            WHERE "executedAt" IS NULL
              AND status IN ('CANCELED', 'REJECTED', 'FAILED', 'EXPIRED', 'ARCHIVED')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // FAILED is excluded: code has always set executedAt on FAILED rows, so any value present
        // is legitimate and should not be cleared. The up backfills the rare historical rows that
        // were missing it due to an old bug, but there is no safe way to reverse that for FAILED.
        await queryRunner.query(`
            UPDATE "transaction"
            SET "executedAt" = NULL
            WHERE status IN ('CANCELED', 'REJECTED', 'EXPIRED', 'ARCHIVED')
        `);
    }
}
