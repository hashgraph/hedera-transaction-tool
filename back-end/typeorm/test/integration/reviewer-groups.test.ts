import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { createTestPostgresContainer } from '../../../test-utils/postgres-test-db';

describe('Reviewer Groups Schema', () => {
  jest.setTimeout(120000);

  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await createTestPostgresContainer()
      .withDatabase('testdb')
      .withUsername('testuser')
      .withPassword('testpass')
      .start();

    Object.assign(AppDataSource.options, {
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      ssl: false,
    });

    dataSource = new DataSource(AppDataSource.options);
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  async function insertUser(email: string): Promise<number> {
    const [row] = await dataSource.query(
      `INSERT INTO "user" (email, password) VALUES ($1, 'x') RETURNING id`,
      [email],
    );
    return row.id;
  }

  async function insertUserKey(userId: number, publicKey: string): Promise<number> {
    const [row] = await dataSource.query(
      `INSERT INTO "user_key" ("userId", "publicKey") VALUES ($1, $2) RETURNING id`,
      [userId, publicKey],
    );
    return row.id;
  }

  async function insertGroup(name: string): Promise<number> {
    const [row] = await dataSource.query(
      `INSERT INTO "reviewer_group" (name, threshold) VALUES ($1, 1) RETURNING id`,
      [name],
    );
    return row.id;
  }

  it('should create all eight new reviewer group tables', async () => {
    const tables = await dataSource.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const names = tables.map((t: any) => t.table_name);

    expect(names).toContain('reviewer_group');
    expect(names).toContain('reviewer_group_member');
    expect(names).toContain('reviewer_rule');
    expect(names).toContain('group_change_record');
    expect(names).toContain('rule_change_record');
    expect(names).toContain('transaction_entity');
    expect(names).toContain('transaction_reviewer_list');
    expect(names).toContain('transaction_reviewer_list_member');
  });

  it('should cascade-delete members and rules when a reviewer_group is deleted', async () => {
    const groupId = await insertGroup('cascade-group');
    const userId = await insertUser('cascade@test.com');
    const keyId = await insertUserKey(userId, 'pk-cascade');

    await dataSource.query(
      `INSERT INTO "reviewer_group_member" ("groupId", "userId", "userKeyId") VALUES ($1, $2, $3)`,
      [groupId, userId, keyId],
    );
    await dataSource.query(
      `INSERT INTO "reviewer_rule" ("groupId", "hederaEntityId", network) VALUES ($1, '0.0.2', 'testnet')`,
      [groupId],
    );

    await dataSource.query(`DELETE FROM "reviewer_group" WHERE id = $1`, [groupId]);

    const members = await dataSource.query(
      `SELECT id FROM "reviewer_group_member" WHERE "groupId" = $1`,
      [groupId],
    );
    const rules = await dataSource.query(
      `SELECT id FROM "reviewer_rule" WHERE "groupId" = $1`,
      [groupId],
    );

    expect(members).toHaveLength(0);
    expect(rules).toHaveLength(0);
  });

  it('should set groupId to null on group_change_record when group is deleted', async () => {
    const groupId = await insertGroup('change-record-group');

    const [record] = await dataSource.query(
      `INSERT INTO "group_change_record" ("groupId", "snapshotVersion", "snapshotPayload", "attestationSignatures")
       VALUES ($1, 1, '{"name":"g"}', '[{"userKeyId":1,"signature":"deadbeef"}]') RETURNING id`,
      [groupId],
    );

    await dataSource.query(`DELETE FROM "reviewer_group" WHERE id = $1`, [groupId]);

    const [row] = await dataSource.query(
      `SELECT "groupId" FROM "group_change_record" WHERE id = $1`,
      [record.id],
    );
    expect(row.groupId).toBeNull();
  });

  it('should set ruleId to null on rule_change_record when rule is deleted', async () => {
    const groupId = await insertGroup('rule-record-group');

    const [rule] = await dataSource.query(
      `INSERT INTO "reviewer_rule" ("groupId", "hederaEntityId", network) VALUES ($1, '0.0.5', 'testnet') RETURNING id`,
      [groupId],
    );
    const [record] = await dataSource.query(
      `INSERT INTO "rule_change_record" ("ruleId", "groupId", "action", "rulePayload")
       VALUES ($1, $2, 'add', '{"hederaEntityId":"0.0.5","network":"testnet"}') RETURNING id`,
      [rule.id, groupId],
    );

    await dataSource.query(`DELETE FROM "reviewer_rule" WHERE id = $1`, [rule.id]);

    const [row] = await dataSource.query(
      `SELECT "ruleId" FROM "rule_change_record" WHERE id = $1`,
      [record.id],
    );
    expect(row.ruleId).toBeNull();
  });

  it('should enforce reviewer_group_member uniqueness on (groupId, userId)', async () => {
    const groupId = await insertGroup('unique-member-group');
    const userId = await insertUser('unique-member@test.com');
    const keyId = await insertUserKey(userId, 'pk-unique-member');

    await dataSource.query(
      `INSERT INTO "reviewer_group_member" ("groupId", "userId", "userKeyId") VALUES ($1, $2, $3)`,
      [groupId, userId, keyId],
    );

    await expect(
      dataSource.query(
        `INSERT INTO "reviewer_group_member" ("groupId", "userId", "userKeyId") VALUES ($1, $2, $3)`,
        [groupId, userId, keyId],
      ),
    ).rejects.toThrow();
  });

  it('should enforce reviewer_rule uniqueness treating two NULLs as equal', async () => {
    const groupId = await insertGroup('null-uniqueness-group');

    await dataSource.query(
      `INSERT INTO "reviewer_rule" ("groupId", "hederaEntityId", network, "entityRole", "transactionType")
       VALUES ($1, '0.0.10', 'testnet', NULL, NULL)`,
      [groupId],
    );

    await expect(
      dataSource.query(
        `INSERT INTO "reviewer_rule" ("groupId", "hederaEntityId", network, "entityRole", "transactionType")
         VALUES ($1, '0.0.10', 'testnet', NULL, NULL)`,
        [groupId],
      ),
    ).rejects.toThrow();
  });

  it('should allow reviewer_rule rows that differ only by entityRole', async () => {
    const groupId = await insertGroup('multi-role-group');

    await dataSource.query(
      `INSERT INTO "reviewer_rule" ("groupId", "hederaEntityId", network, "entityRole") VALUES ($1, '0.0.20', 'testnet', 'sender')`,
      [groupId],
    );
    await dataSource.query(
      `INSERT INTO "reviewer_rule" ("groupId", "hederaEntityId", network, "entityRole") VALUES ($1, '0.0.20', 'testnet', 'receiver')`,
      [groupId],
    );

    const rows = await dataSource.query(
      `SELECT id FROM "reviewer_rule" WHERE "groupId" = $1`,
      [groupId],
    );
    expect(rows).toHaveLength(2);
  });

  it('should set groupId to null on rule_change_record when group is deleted', async () => {
    const groupId = await insertGroup('rule-record-group-null');

    const [record] = await dataSource.query(
      `INSERT INTO "rule_change_record" ("groupId", "action", "rulePayload")
       VALUES ($1, 'add', '{"hederaEntityId":"0.0.6","network":"testnet"}') RETURNING id`,
      [groupId],
    );

    await dataSource.query(`DELETE FROM "reviewer_group" WHERE id = $1`, [groupId]);

    const [row] = await dataSource.query(
      `SELECT "groupId" FROM "rule_change_record" WHERE id = $1`,
      [record.id],
    );
    expect(row.groupId).toBeNull();
  });

  it('should enforce transaction_entity uniqueness on (transactionId, hederaEntityId, network, entityRole)', async () => {
    const userId = await insertUser('entity-unique@test.com');
    const keyId = await insertUserKey(userId, 'pk-entity-unique');

    const [tx] = await dataSource.query(
      `INSERT INTO "transaction" (name, type, description, "transactionId", "transactionHash", "transactionBytes", "unsignedTransactionBytes", status, signature, "validStart", "mirrorNetwork", "creatorKeyId")
       VALUES ('t2', 'TRANSFER', 'desc', 'tid2', 'hash2', decode('00', 'hex'), decode('00', 'hex'), 'NEW', decode('00', 'hex'), now(), 'testnet', $1) RETURNING id`,
      [keyId],
    );

    await dataSource.query(
      `INSERT INTO "transaction_entity" ("transactionId", "hederaEntityId", network, "entityRole") VALUES ($1, '0.0.30', 'testnet', 'sender')`,
      [tx.id],
    );

    await expect(
      dataSource.query(
        `INSERT INTO "transaction_entity" ("transactionId", "hederaEntityId", network, "entityRole") VALUES ($1, '0.0.30', 'testnet', 'sender')`,
        [tx.id],
      ),
    ).rejects.toThrow();
  });

  it('should enforce transaction_reviewer_list_member uniqueness on (listId, userId)', async () => {
    const userId = await insertUser('list-member@test.com');
    const keyId = await insertUserKey(userId, 'pk-list-member');

    const [tx] = await dataSource.query(
      `INSERT INTO "transaction" (name, type, description, "transactionId", "transactionHash", "transactionBytes", "unsignedTransactionBytes", status, signature, "validStart", "mirrorNetwork", "creatorKeyId")
       VALUES ('t1', 'TRANSFER', 'desc', 'tid1', 'hash1', decode('00', 'hex'), decode('00', 'hex'), 'NEW', decode('00', 'hex'), now(), 'testnet', $1) RETURNING id`,
      [keyId],
    );
    const [list] = await dataSource.query(
      `INSERT INTO "transaction_reviewer_list" ("transactionId", threshold) VALUES ($1, 1) RETURNING id`,
      [tx.id],
    );

    await dataSource.query(
      `INSERT INTO "transaction_reviewer_list_member" ("listId", "userId") VALUES ($1, $2)`,
      [list.id, userId],
    );

    await expect(
      dataSource.query(
        `INSERT INTO "transaction_reviewer_list_member" ("listId", "userId") VALUES ($1, $2)`,
        [list.id, userId],
      ),
    ).rejects.toThrow();
  });
});
