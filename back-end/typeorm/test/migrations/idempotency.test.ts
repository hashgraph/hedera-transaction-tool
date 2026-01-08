import { createTestPostgresDataSource } from '../../../test-utils/postgres-test-db';

describe('Migration Idempotency', () => {
  jest.setTimeout(60000);

  let db: Awaited<ReturnType<typeof createTestPostgresDataSource>>;

  beforeAll(async () => {
    db = await createTestPostgresDataSource();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('should run migrations successfully', async () => {
    const migrations = await db.dataSource.showMigrations();
    expect(migrations).toBe(false);
  });

  it('should be idempotent', async () => {
    await expect(db.dataSource.runMigrations()).resolves.not.toThrow();
  });
});