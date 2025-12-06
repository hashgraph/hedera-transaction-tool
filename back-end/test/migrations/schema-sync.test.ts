import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../../typeorm/data-source';

describe('Schema Synchronization', () => {
  jest.setTimeout(60000);

  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Start ephemeral Postgres
    container = await new PostgreSqlContainer()
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

    // If there are SQL statements, schema is out of sync
    expect(sqls.upQueries).toHaveLength(0);
    expect(sqls.downQueries).toHaveLength(0);
  });
});