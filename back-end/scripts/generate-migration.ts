import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { execSync } from 'child_process';

async function generateMigration(name: string) {
  console.log('Starting temporary Postgres container...');

  const container = await new PostgreSqlContainer()
    .withDatabase('migration_gen')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  console.log('Container started successfully');

  try {
    const dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),

      entities: [
        join(__dirname, '../libs/**/*.entity.ts'),
      ],

      migrations: [
        join(__dirname, '../typeorm/migrations/*.ts'),
      ],

      migrationsTableName: 'migrations',
      synchronize: false,
    });

    console.log('Connecting to temporary database...');
    await dataSource.initialize();

    console.log('Running existing migrations...');
    await dataSource.runMigrations();

    console.log('Closing connection...');
    await dataSource.destroy();

    console.log(`Generating migration: ${name}...`);

    try {
      execSync(
        `pnpm typeorm migration:generate typeorm/migrations/${name} -d typeorm/data-source.ts`,
        {
          stdio: 'pipe',
          env: {
            ...process.env,
            POSTGRES_HOST: container.getHost(),
            POSTGRES_PORT: container.getMappedPort(5432).toString(),
            POSTGRES_USERNAME: container.getUsername(),
            POSTGRES_PASSWORD: container.getPassword(),
            POSTGRES_DATABASE: container.getDatabase(),
          },
        }
      );
      console.log('✅ Migration generated successfully!');
    } catch (error: any) {
      // TypeORM exits with code 1 when no changes found
      if (error.status === 1 && error.stdout?.toString().includes('No changes in database schema')) {
        console.log('ℹ️  No schema changes detected - no migration needed');
        return;
      }
      throw error;
    }
  } catch (error: any) {
    const output = error.stderr?.toString() || error.stdout?.toString() || '';

    if (output.includes('No changes in database schema were found')) {
      console.log('ℹ️  No schema changes detected - no migration needed');
      return;
    }

    // Real error - show output and throw
    console.error(output);
    throw error;
  } finally {
    console.log('Stopping container...');
    await container.stop();
    console.log('Container stopped');
  }
}

const migrationName = process.argv[2];
if (!migrationName) {
  console.error('Usage: ts-node scripts/generate-migration.ts MigrationName');
  process.exit(1);
}

generateMigration(migrationName).catch((error) => {
  console.error(error);
  process.exit(1);
});