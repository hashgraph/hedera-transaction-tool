import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1764999592722 implements MigrationInterface {
    name = 'InitialSchema1764999592722'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "transaction_approver" ("id" SERIAL NOT NULL, "transactionId" integer, "listId" integer, "threshold" integer, "userKeyId" integer, "signature" bytea, "userId" integer, "approved" boolean, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_d6d9eeb7f5b3590e3a20888463e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "transaction_comment" ("id" SERIAL NOT NULL, "message" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "transactionId" integer, "userId" integer, CONSTRAINT "PK_67f9bea51814cdd1344eaab12f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "transaction_group" ("id" SERIAL NOT NULL, "description" character varying NOT NULL, "atomic" boolean NOT NULL DEFAULT false, "sequential" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_585c04973aeb5fde876cd7451be" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "transaction_group_item" ("seq" integer NOT NULL, "transactionId" integer NOT NULL, "groupId" integer, CONSTRAINT "PK_9ed80c1d79b7ed7a957d0951a72" PRIMARY KEY ("transactionId"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "transaction_observer" ("id" SERIAL NOT NULL, "role" character varying NOT NULL, "userId" integer NOT NULL, "transactionId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8c6100299f3f937ced4a74c2be3" PRIMARY KEY ("userId", "transactionId"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "transaction_signer" ("id" SERIAL NOT NULL, "transactionId" integer NOT NULL, "userKeyId" integer NOT NULL, "userId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e7d778a4903a0946bda00650cf5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "notification" ("id" SERIAL NOT NULL, "type" character varying NOT NULL, "entityId" integer, "additionalData" json DEFAULT '{}', "actorId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "notification_receiver" ("id" SERIAL NOT NULL, "notificationId" integer NOT NULL, "userId" integer NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "isInAppNotified" boolean DEFAULT false, "isEmailSent" boolean DEFAULT false, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_90543bacf107cdd564e9b62cd20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "notification_preferences" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "type" character varying NOT NULL, "email" boolean NOT NULL DEFAULT true, "inApp" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "transaction" ("id" SERIAL NOT NULL, "name" character varying(50) NOT NULL, "type" character varying NOT NULL, "description" character varying(256) NOT NULL, "transactionId" character varying NOT NULL, "transactionHash" character varying NOT NULL, "transactionBytes" bytea NOT NULL, "unsignedTransactionBytes" bytea NOT NULL, "status" character varying NOT NULL, "statusCode" integer, "signature" bytea NOT NULL, "validStart" TIMESTAMP NOT NULL, "mirrorNetwork" character varying NOT NULL, "isManual" boolean NOT NULL DEFAULT false, "cutoffAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "executedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "creatorKeyId" integer, CONSTRAINT "PK_89eadb93a89810556e1cbcd6ab9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "user_key" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "mnemonicHash" character varying, "index" integer, "publicKey" character varying(128) NOT NULL, "deletedAt" TIMESTAMP, CONSTRAINT "PK_fc283fee4f4e9c467b434199258" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_4f831ea35fcbc17f8df7f5b10a" ON "user_key" ("publicKey") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "user" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "admin" boolean NOT NULL DEFAULT false, "status" character varying NOT NULL DEFAULT 'NEW', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);

        // Add foreign keys with existence check
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_approver", "FK_f68cf6105a89f541285e9095f43", '"transactionId"', '"transaction"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_approver", "FK_20c31a39e8783b6e888ed9dee45", '"listId"', '"transaction_approver"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_approver", "FK_78ab241fea906fe2fa317726311", '"userKeyId"', '"user_key"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_approver", "FK_b5401848ee318619792d9ead127", '"userId"', '"user"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_comment", "FK_5c5d7830f0197b9e92276cf6de5", '"transactionId"', '"transaction"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_comment", "FK_b27b7ec1b677ed4a2fa5304b131", '"userId"', '"user"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_group_item", "FK_9ed80c1d79b7ed7a957d0951a72", '"transactionId"', '"transaction"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_group_item", "FK_a86690b96e78a551252bfe15d91", '"groupId"', '"transaction_group"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_observer", "FK_adbc3bb6e05cc969fa33da99de9", '"userId"', '"user"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_observer", "FK_e4c900dabed404bf1348a0764cb", '"transactionId"', '"transaction"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_signer", "FK_448473a70d8b12e7726460576e8", '"transactionId"', '"transaction"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_signer", "FK_668417c7f11289bdb2b52327871", '"userKeyId"', '"user_key"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction_signer", "FK_3ddc656bc4e8bf7c4071ad7c215", '"userId"', '"user"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "notification", "FK_c5133a026bd1b3d9feccac1a234", '"actorId"', '"user"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "notification_receiver", "FK_3059a57127fb6b14dc2c2d195b9", '"notificationId"', '"notification"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "notification_receiver", "FK_dd06311b95c6bc4a623594aa6e9", '"userId"', '"user"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "notification_preferences", "FK_b70c44e8b00757584a393225593", '"userId"', '"user"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "transaction", "FK_639c8f133945198847ee5b200b2", '"creatorKeyId"', '"user_key"("id")');
        await this.addForeignKeyIfNotExists(queryRunner, "user_key", "FK_123efe6d100956719d638500e5e", '"userId"', '"user"("id")');
    }

    private async addForeignKeyIfNotExists(
      queryRunner: QueryRunner,
      table: string,
      constraintName: string,
      column: string,
      references: string
    ): Promise<void> {
        const checkQuery = `
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = '${table}' 
            AND constraint_name = '${constraintName}'
        `;
        const result = await queryRunner.query(checkQuery);

        if (result.length === 0) {
            await queryRunner.query(
              `ALTER TABLE "${table}" ADD CONSTRAINT "${constraintName}" FOREIGN KEY (${column}) REFERENCES ${references} ON DELETE NO ACTION ON UPDATE NO ACTION`
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_key" DROP CONSTRAINT IF EXISTS "FK_123efe6d100956719d638500e5e"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS "FK_639c8f133945198847ee5b200b2"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT IF EXISTS "FK_b70c44e8b00757584a393225593"`);
        await queryRunner.query(`ALTER TABLE "notification_receiver" DROP CONSTRAINT IF EXISTS "FK_dd06311b95c6bc4a623594aa6e9"`);
        await queryRunner.query(`ALTER TABLE "notification_receiver" DROP CONSTRAINT IF EXISTS "FK_3059a57127fb6b14dc2c2d195b9"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "FK_c5133a026bd1b3d9feccac1a234"`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP CONSTRAINT IF EXISTS "FK_3ddc656bc4e8bf7c4071ad7c215"`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP CONSTRAINT IF EXISTS "FK_668417c7f11289bdb2b52327871"`);
        await queryRunner.query(`ALTER TABLE "transaction_signer" DROP CONSTRAINT IF EXISTS "FK_448473a70d8b12e7726460576e8"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT IF EXISTS "FK_e4c900dabed404bf1348a0764cb"`);
        await queryRunner.query(`ALTER TABLE "transaction_observer" DROP CONSTRAINT IF EXISTS "FK_adbc3bb6e05cc969fa33da99de9"`);
        await queryRunner.query(`ALTER TABLE "transaction_group_item" DROP CONSTRAINT IF EXISTS "FK_a86690b96e78a551252bfe15d91"`);
        await queryRunner.query(`ALTER TABLE "transaction_group_item" DROP CONSTRAINT IF EXISTS "FK_9ed80c1d79b7ed7a957d0951a72"`);
        await queryRunner.query(`ALTER TABLE "transaction_comment" DROP CONSTRAINT IF EXISTS "FK_b27b7ec1b677ed4a2fa5304b131"`);
        await queryRunner.query(`ALTER TABLE "transaction_comment" DROP CONSTRAINT IF EXISTS "FK_5c5d7830f0197b9e92276cf6de5"`);
        await queryRunner.query(`ALTER TABLE "transaction_approver" DROP CONSTRAINT IF EXISTS "FK_b5401848ee318619792d9ead127"`);
        await queryRunner.query(`ALTER TABLE "transaction_approver" DROP CONSTRAINT IF EXISTS "FK_78ab241fea906fe2fa317726311"`);
        await queryRunner.query(`ALTER TABLE "transaction_approver" DROP CONSTRAINT IF EXISTS "FK_20c31a39e8783b6e888ed9dee45"`);
        await queryRunner.query(`ALTER TABLE "transaction_approver" DROP CONSTRAINT IF EXISTS "FK_f68cf6105a89f541285e9095f43"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_4f831ea35fcbc17f8df7f5b10a"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user_key"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "transaction"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_receiver"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "notification"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "transaction_signer"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "transaction_observer"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "transaction_group_item"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "transaction_group"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "transaction_comment"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "transaction_approver"`);
    }
}