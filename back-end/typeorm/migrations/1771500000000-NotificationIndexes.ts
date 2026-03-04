import { MigrationInterface, QueryRunner } from "typeorm";

export class NotificationIndexes1771500000000 implements MigrationInterface {
    name = 'NotificationIndexes1771500000000'
    transaction = false as const;

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_notification_type_entityId"
             ON "notification" ("type", "entityId")`
        );
        await queryRunner.query(
            `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_notification_receiver_userId_isRead"
             ON "notification_receiver" ("userId", "isRead")`
        );
        await queryRunner.query(
            `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_notification_receiver_notificationId"
             ON "notification_receiver" ("notificationId")`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_notification_receiver_notificationId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_notification_receiver_userId_isRead"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_notification_type_entityId"`);
    }
}
