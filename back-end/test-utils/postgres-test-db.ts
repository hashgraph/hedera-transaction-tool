import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../typeorm/data-source';

const POSTGRES_TEST_IMAGE = 'postgres:16.13-alpine3.22';

const DIAG_TAG = '[pg-test-db]';
function diag(message: string, extra?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    pid: process.pid,
    ...extra,
  };
  // eslint-disable-next-line no-console
  console.log(`${DIAG_TAG} ${message}`, payload);
}

export function createTestPostgresContainer() {
  return new PostgreSqlContainer(POSTGRES_TEST_IMAGE);
}

export async function createTestPostgresDataSource() {
  const overallStart = Date.now();
  diag('createTestPostgresDataSource:start');

  let container: Awaited<ReturnType<ReturnType<typeof createTestPostgresContainer>['start']>> | undefined;
  try {
    const containerStart = Date.now();
    diag('container.start:begin', { image: POSTGRES_TEST_IMAGE });
    container = await createTestPostgresContainer()
      .withDatabase('testdb')
      .withUsername('testuser')
      .withPassword('testpass')
      .start();
    diag('container.start:done', {
      elapsedMs: Date.now() - containerStart,
      containerId: container.getId(),
      containerName: container.getName(),
      host: container.getHost(),
      mappedPort: container.getMappedPort(5432),
    });

    Object.assign(AppDataSource.options, {
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    });

    const initStart = Date.now();
    diag('dataSource.initialize:begin');
    const dataSource = new DataSource(AppDataSource.options);
    await dataSource.initialize();
    diag('dataSource.initialize:done', { elapsedMs: Date.now() - initStart });

    const migrateStart = Date.now();
    diag('dataSource.runMigrations:begin');
    const migrations = await dataSource.runMigrations();
    diag('dataSource.runMigrations:done', {
      elapsedMs: Date.now() - migrateStart,
      appliedCount: migrations.length,
      applied: migrations.map((m) => m.name),
    });

    diag('createTestPostgresDataSource:ready', { totalElapsedMs: Date.now() - overallStart });

    return {
      dataSource,
      container,
      async cleanup() {
        const cleanupStart = Date.now();
        diag('cleanup:begin', { containerId: container!.getId() });
        try {
          await dataSource.destroy();
          diag('cleanup:dataSource.destroy:done', { elapsedMs: Date.now() - cleanupStart });
        } catch (err) {
          diag('cleanup:dataSource.destroy:error', {
            message: (err as Error)?.message,
            stack: (err as Error)?.stack,
          });
          throw err;
        }
        const stopStart = Date.now();
        try {
          await container!.stop();
          diag('cleanup:container.stop:done', { elapsedMs: Date.now() - stopStart });
        } catch (err) {
          diag('cleanup:container.stop:error', {
            message: (err as Error)?.message,
            stack: (err as Error)?.stack,
          });
          throw err;
        }
      },
    };
  } catch (err) {
    diag('createTestPostgresDataSource:error', {
      elapsedMs: Date.now() - overallStart,
      containerStarted: Boolean(container),
      containerId: container?.getId(),
      message: (err as Error)?.message,
      name: (err as Error)?.name,
      stack: (err as Error)?.stack,
    });
    // Best-effort teardown so a failed boot doesn't leak a container.
    if (container) {
      try {
        await container.stop();
      } catch (stopErr) {
        diag('createTestPostgresDataSource:error:stop-failed', {
          message: (stopErr as Error)?.message,
        });
      }
    }
    throw err;
  }
}
