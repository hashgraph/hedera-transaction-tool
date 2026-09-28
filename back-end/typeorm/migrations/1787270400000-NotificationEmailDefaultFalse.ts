import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationEmailDefaultFalse1787270400000 implements MigrationInterface {
    name = 'NotificationEmailDefaultFalse1787270400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "email" SET DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "email" SET DEFAULT true`);
    }
}
