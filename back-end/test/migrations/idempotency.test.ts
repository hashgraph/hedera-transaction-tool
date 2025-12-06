import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../../typeorm/data-source';

describe('Migration Idempotency', () => {
  jest.setTimeout(60000);

  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let dataSource: DataSource;

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

    dataSource = new DataSource(AppDataSource.options);
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  it('should run migrations successfully', async () => {
    await dataSource.runMigrations();
    const migrations = await dataSource.showMigrations();
    expect(migrations).toBe(false); // false means all migrations are applied
  });

  it('should be idempotent - running twice should not fail', async () => {
    await dataSource.runMigrations();
    await expect(dataSource.runMigrations()).resolves.not.toThrow();
  });
});