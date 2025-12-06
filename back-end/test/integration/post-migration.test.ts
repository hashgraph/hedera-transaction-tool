import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { AppDataSource } from '../../typeorm/data-source';

describe('Post-Migration Database Validation', () => {
  jest.setTimeout(60000);

  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer()
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
    });

    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  });

  afterAll(async () => {
    await AppDataSource.destroy();
    await container.stop();
  });

  it('should have all expected tables', async () => {
    const tables = await AppDataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    const tableNames = tables.map((t: any) => t.table_name);
    expect(tableNames).toContain('user');
    expect(tableNames).toContain('user_key');
    expect(tableNames).toContain('transaction');
  });

  it('should be able to query critical tables', async () => {
    await expect(
      AppDataSource.query('SELECT * FROM "user" LIMIT 1')
    ).resolves.toBeDefined();
  });
});
