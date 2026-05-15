import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../typeorm/data-source';
import { enableDiag } from './diag-enabled';

const POSTGRES_TEST_IMAGE = 'postgres:16.13-alpine3.22';

const DIAG_TAG = '[pg-test-db]';
function diag(message: string, extra?: Record<string, unknown>) {
  if (!enableDiag) return;
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
  // Hoisted out of the `try` so the outer catch can reach it for best-effort
  // teardown if a later step (e.g. runMigrations) throws after initialize().
  let dataSource: DataSource | undefined;
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
    dataSource = new DataSource(AppDataSource.options);
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

        // Capture errors from each step instead of rethrowing the first one,
        // so a failed `dataSource.destroy()` never blocks `container.stop()`
        // from running. A leaked testcontainer holds a port and a Docker
        // resource indefinitely; that's worse than a noisy error log.
        let destroyErr: Error | undefined;
        let stopErr: Error | undefined;

        try {
          await dataSource.destroy();
          diag('cleanup:dataSource.destroy:done', { elapsedMs: Date.now() - cleanupStart });
        } catch (err) {
          destroyErr = err as Error;
          diag('cleanup:dataSource.destroy:error', {
            message: destroyErr?.message,
            stack: destroyErr?.stack,
          });
        }

        const stopStart = Date.now();
        try {
          await container!.stop();
          diag('cleanup:container.stop:done', { elapsedMs: Date.now() - stopStart });
        } catch (err) {
          stopErr = err as Error;
          diag('cleanup:container.stop:error', {
            message: stopErr?.message,
            stack: stopErr?.stack,
          });
        }

        // Aggregate when both occurred so neither error is dropped and we
        // don't mutate the upstream Error instances (TypeORM/pg often expose
        // the same Error reference elsewhere with their own `cause` chain).
        if (destroyErr && stopErr) {
          throw new AggregateError(
            [destroyErr, stopErr],
            'cleanup failed: dataSource.destroy and container.stop both threw',
          );
        }
        if (destroyErr) {
          throw destroyErr;
        }
        if (stopErr) {
          throw stopErr;
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
    // Best-effort teardown so a failed boot doesn't leak handles or a
    // container. Destroy the (possibly partially-initialized) DataSource
    // first to close the JS-level pool — otherwise `detectOpenHandles`
    // reports lingering PG sockets even after the container is killed.
    // We deliberately do NOT gate on `dataSource.isInitialized`: a failure
    // partway through `initialize()` can leave the flag false while pg
    // sockets are already open, and `destroy()` on an uninit'd DataSource
    // either no-ops or throws (caught below).
    if (dataSource) {
      try {
        await dataSource.destroy();
      } catch (destroyErr) {
        diag('createTestPostgresDataSource:error:destroy-failed', {
          message: (destroyErr as Error)?.message,
        });
      }
    }
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
