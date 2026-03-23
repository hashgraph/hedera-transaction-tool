import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../typeorm/data-source';

const POSTGRES_TEST_IMAGE = 'postgres:16.13-alpine3.22';

export function createTestPostgresContainer() {
  return new PostgreSqlContainer(POSTGRES_TEST_IMAGE);
}

export async function createTestPostgresDataSource() {
  const container = await createTestPostgresContainer()
    .withDatabase('testdb')
    .withUsername('testuser')
    .withPassword('testpass')
    .start();

  Object.assign(AppDataSource.options, {
    host: container.getHost(),
    port: container.getMappedPort(5432),
    username: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
  });

  const dataSource = new DataSource(AppDataSource.options);
  await dataSource.initialize();
  await dataSource.runMigrations();

  return {
    dataSource,
    container,
    async cleanup() {
      await dataSource.destroy();
      await container.stop();
    },
  };
}