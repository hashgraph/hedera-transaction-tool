import { MigrationInterface, QueryRunner } from "typeorm";

export class IndexFixesForCaching1768289349311 implements MigrationInterface {
    name = 'IndexFixesForCaching1768289349311'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cached_account_key" DROP CONSTRAINT "FK_6b47de5c8e68b4a72842efbdb5d"`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" DROP CONSTRAINT "FK_8dc5f197e332408f0f36ae6bb09"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" DROP CONSTRAINT "FK_dbc191576f835329713255f6569"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" DROP CONSTRAINT "FK_277ff9b04bbdf90f59d1b665e48"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b47de5c8e68b4a72842efbdb5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dd83b9bbaa565876724587bceb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8dc5f197e332408f0f36ae6bb0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c5bf2f6cd932e86d5f38469ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5371c7315c13f28d6aa078701d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dbc191576f835329713255f656"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c440b7f3bbb5a2c63719879f2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_57fdd9fee697866dfc5987f685"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_277ff9b04bbdf90f59d1b665e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63c239fd4ff264c1643b296676"`);
        await queryRunner.query(`ALTER TABLE "cached_account_key" RENAME COLUMN "accountId" TO "cachedAccountId"`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" RENAME COLUMN "nodeId" TO "cachedNodeId"`);
        await queryRunner.query(`ALTER TABLE "cached_account" DROP COLUMN "lastCheckedAt"`);
        await queryRunner.query(`ALTER TABLE "cached_node" DROP COLUMN "lastCheckedAt"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" RENAME COLUMN "accountId" TO "cachedAccountId"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" ALTER COLUMN "cachedAccountId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" RENAME COLUMN "nodeId" TO "cachedNodeId"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" ALTER COLUMN "cachedNodeId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_group_item" DROP CONSTRAINT "FK_a86690b96e78a551252bfe15d91"`);
        await queryRunner.query(`ALTER TABLE "transaction_group_item" ALTER COLUMN "groupId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT "FK_adbc3bb6e05cc969fa33da99de9"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT "FK_e4c900dabed404bf1348a0764cb"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT "PK_8c6100299f3f937ced4a74c2be3"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" ADD CONSTRAINT "PK_8d7b766a488f01e47c888fc0223" PRIMARY KEY ("userId", "transactionId", "id")`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT "PK_8d7b766a488f01e47c888fc0223"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" ADD CONSTRAINT "PK_faa437e5083a12325090a134e3b" PRIMARY KEY ("id", "transactionId")`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT "PK_faa437e5083a12325090a134e3b"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" ADD CONSTRAINT "PK_44d3d9863ce059e66f2cf50fe5e" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "cached_account_key" ALTER COLUMN "cachedAccountId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" ALTER COLUMN "cachedNodeId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" DROP CONSTRAINT "FK_5371c7315c13f28d6aa078701dd"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" ALTER COLUMN "transactionId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" DROP CONSTRAINT "FK_57fdd9fee697866dfc5987f6855"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" ALTER COLUMN "transactionId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT "FK_639c8f133945198847ee5b200b2"`);
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "creatorKeyId" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_b5401848ee318619792d9ead12" ON "transaction_approver" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f68cf6105a89f541285e9095f4" ON "transaction_approver" ("transactionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_953ae2424ce25d5db80bd2bb5e" ON "transaction_group_item" ("transactionId", "groupId") `);
        await queryRunner.query(`CREATE INDEX "IDX_adbc3bb6e05cc969fa33da99de" ON "transaction_observer" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e4c900dabed404bf1348a0764c" ON "transaction_observer" ("transactionId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8c6100299f3f937ced4a74c2be" ON "transaction_observer" ("userId", "transactionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f8cbac3e0cae3730a762e4905e" ON "transaction_signer" ("transactionId", "userKeyId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d4b2638a738514c92f6d4d0b5e" ON "cached_account_key" ("cachedAccountId", "publicKey") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_52777acea4390b605f07ead3ea" ON "cached_node_admin_key" ("cachedNodeId", "publicKey") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7323f510bfe3c24317c2aecd23" ON "transaction_cached_account" ("transactionId", "cachedAccountId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1446d62dccc7129186a6858616" ON "transaction_cached_node" ("transactionId", "cachedNodeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_639c8f133945198847ee5b200b" ON "transaction" ("creatorKeyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ecdea5a0d1a525ff3451bd3b27" ON "transaction" ("status", "mirrorNetwork") `);
        await queryRunner.query(`ALTER TABLE "transaction_group_item" ADD CONSTRAINT "FK_a86690b96e78a551252bfe15d91" FOREIGN KEY ("groupId") REFERENCES "transaction_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" ADD CONSTRAINT "FK_adbc3bb6e05cc969fa33da99de9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" ADD CONSTRAINT "FK_e4c900dabed404bf1348a0764cb" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cached_account_key" ADD CONSTRAINT "FK_c34020a05335ddec9d691691918" FOREIGN KEY ("cachedAccountId") REFERENCES "cached_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" ADD CONSTRAINT "FK_c8e997c26ee25348fb2d19c6a21" FOREIGN KEY ("cachedNodeId") REFERENCES "cached_node"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" ADD CONSTRAINT "FK_5371c7315c13f28d6aa078701dd" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" ADD CONSTRAINT "FK_6820790916167d4523fe8e82b67" FOREIGN KEY ("cachedAccountId") REFERENCES "cached_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" ADD CONSTRAINT "FK_57fdd9fee697866dfc5987f6855" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" ADD CONSTRAINT "FK_d7e273f9ca65f5a69a4571b5ee9" FOREIGN KEY ("cachedNodeId") REFERENCES "cached_node"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD CONSTRAINT "FK_639c8f133945198847ee5b200b2" FOREIGN KEY ("creatorKeyId") REFERENCES "user_key"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // Non-reversible data update: mark all in-app-notified notifications as read
        await queryRunner.query(
          `UPDATE "notification_receiver" SET "isRead" = TRUE WHERE "isInAppNotified" = TRUE`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT "FK_639c8f133945198847ee5b200b2"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" DROP CONSTRAINT "FK_d7e273f9ca65f5a69a4571b5ee9"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" DROP CONSTRAINT "FK_57fdd9fee697866dfc5987f6855"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" DROP CONSTRAINT "FK_6820790916167d4523fe8e82b67"`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" DROP CONSTRAINT "FK_5371c7315c13f28d6aa078701dd"`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" DROP CONSTRAINT "FK_c8e997c26ee25348fb2d19c6a21"`);
        await queryRunner.query(`ALTER TABLE "cached_account_key" DROP CONSTRAINT "FK_c34020a05335ddec9d691691918"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT "FK_e4c900dabed404bf1348a0764cb"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT "FK_adbc3bb6e05cc969fa33da99de9"`);
        await queryRunner.query(`ALTER TABLE "transaction_group_item" DROP CONSTRAINT "FK_a86690b96e78a551252bfe15d91"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ecdea5a0d1a525ff3451bd3b27"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_639c8f133945198847ee5b200b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1446d62dccc7129186a6858616"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7323f510bfe3c24317c2aecd23"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52777acea4390b605f07ead3ea"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d4b2638a738514c92f6d4d0b5e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8cbac3e0cae3730a762e4905e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8c6100299f3f937ced4a74c2be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e4c900dabed404bf1348a0764c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_adbc3bb6e05cc969fa33da99de"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_953ae2424ce25d5db80bd2bb5e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f68cf6105a89f541285e9095f4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b5401848ee318619792d9ead12"`);
        await queryRunner.query(`ALTER TABLE "transaction" ALTER COLUMN "creatorKeyId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD CONSTRAINT "FK_639c8f133945198847ee5b200b2" FOREIGN KEY ("creatorKeyId") REFERENCES "user_key"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" ALTER COLUMN "transactionId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" ADD CONSTRAINT "FK_57fdd9fee697866dfc5987f6855" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" ALTER COLUMN "transactionId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" ADD CONSTRAINT "FK_5371c7315c13f28d6aa078701dd" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" ALTER COLUMN "cachedNodeId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cached_account_key" ALTER COLUMN "cachedAccountId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT "PK_44d3d9863ce059e66f2cf50fe5e"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" ADD CONSTRAINT "PK_faa437e5083a12325090a134e3b" PRIMARY KEY ("id", "transactionId")`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT "PK_faa437e5083a12325090a134e3b"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" ADD CONSTRAINT "PK_8d7b766a488f01e47c888fc0223" PRIMARY KEY ("id", "userId", "transactionId")`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT "PK_8d7b766a488f01e47c888fc0223"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" ADD CONSTRAINT "PK_8c6100299f3f937ced4a74c2be3" PRIMARY KEY ("userId", "transactionId")`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" ADD CONSTRAINT "FK_e4c900dabed404bf1348a0764cb" FOREIGN KEY ("transactionId") REFERENCES "transaction"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" ADD CONSTRAINT "FK_adbc3bb6e05cc969fa33da99de9" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_group_item" ALTER COLUMN "groupId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_group_item" ADD CONSTRAINT "FK_a86690b96e78a551252bfe15d91" FOREIGN KEY ("groupId") REFERENCES "transaction_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" ALTER COLUMN "cachedNodeId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" ALTER COLUMN "cachedAccountId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" RENAME COLUMN "cachedNodeId" TO 'nodeId'`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" RENAME COLUMN "cachedAccountId" TO "accountId"`);
        await queryRunner.query(`ALTER TABLE "cached_node" ADD "lastCheckedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "cached_account" ADD "lastCheckedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" RENAME COLUMN "cachedNodeId" TO "nodeId"`);
        await queryRunner.query(`ALTER TABLE "cached_account_key" RENAME COLUMN "cachedAccountId" TO "accountId"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_63c239fd4ff264c1643b296676" ON "transaction_cached_node" ("transactionId", "nodeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_277ff9b04bbdf90f59d1b665e4" ON "transaction_cached_node" ("nodeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_57fdd9fee697866dfc5987f685" ON "transaction_cached_node" ("transactionId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4c440b7f3bbb5a2c63719879f2" ON "transaction_cached_account" ("transactionId", "accountId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dbc191576f835329713255f656" ON "transaction_cached_account" ("accountId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5371c7315c13f28d6aa078701d" ON "transaction_cached_account" ("transactionId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0c5bf2f6cd932e86d5f38469ce" ON "cached_node_admin_key" ("publicKey", "nodeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8dc5f197e332408f0f36ae6bb0" ON "cached_node_admin_key" ("nodeId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dd83b9bbaa565876724587bceb" ON "cached_account_key" ("publicKey", "accountId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b47de5c8e68b4a72842efbdb5" ON "cached_account_key" ("accountId") `);
        await queryRunner.query(`ALTER TABLE "transaction_cached_node" ADD CONSTRAINT "FK_277ff9b04bbdf90f59d1b665e48" FOREIGN KEY ("nodeId") REFERENCES "cached_node"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_cached_account" ADD CONSTRAINT "FK_dbc191576f835329713255f6569" FOREIGN KEY ("accountId") REFERENCES "cached_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cached_node_admin_key" ADD CONSTRAINT "FK_8dc5f197e332408f0f36ae6bb09" FOREIGN KEY ("nodeId") REFERENCES "cached_node"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cached_account_key" ADD CONSTRAINT "FK_6b47de5c8e68b4a72842efbdb5d" FOREIGN KEY ("accountId") REFERENCES "cached_account"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
