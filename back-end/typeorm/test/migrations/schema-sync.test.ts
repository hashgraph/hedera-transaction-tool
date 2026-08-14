import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { createTestPostgresContainer } from '../../../test-utils/postgres-test-db';

describe('Schema Synchronization', () => {
  jest.setTimeout(60000);

  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Start ephemeral Postgres
    container = await createTestPostgresContainer()
      .withDatabase('testdb')
      .withUsername('testuser')
      .withPassword('testpass')
      .start();

    // Override AppDataSource options for this test
    Object.assign(AppDataSource.options, {
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      ssl: false,
    });

    // Recreate instance (important if AppDataSource was already initialized)
    dataSource = new DataSource(AppDataSource.options);

    await dataSource.initialize();

    // Ensure DB schema is up-to-date (run your migrations)
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  it('should have no pending schema changes', async () => {
    const schemaBuilder = dataSource.driver.createSchemaBuilder();
    const sqls = await schemaBuilder.log();

    // Functional indexes created in migrations cannot be expressed via TypeORM
    // entity decorators, so we exclude them from the schema-sync check.
    const migrationManagedIndexes = [
      'UQ_reviewer_rule_entity_network_group_role_type',
      'IDX_group_change_record_pending_groupId',
      'IDX_rule_change_record_pending_ruleId',
    ];
    const isKnown = (q: { query: string }) =>
      migrationManagedIndexes.some(name => q.query.includes(name));

    expect(sqls.upQueries.filter(q => !isKnown(q))).toHaveLength(0);
    expect(sqls.downQueries.filter(q => !isKnown(q))).toHaveLength(0);
  });
});