import { DataSource } from 'typeorm';
import { extname, join } from 'path';

const isCompiled =
  process.env.NODE_ENV === 'production' ||
  extname(__filename) === '.js';

const fileExt = isCompiled ? 'js' : 'ts';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USERNAME || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DATABASE || 'postgres',

  // Entities: .ts in dev, .js in production/Docker
  entities: [
    join(
      __dirname, `../libs/common/src/database/entities/**/*.entity.${fileExt}`
    ),
  ],

  // Migrations: .ts in dev (with ts-node), .js in production
  migrations: [
    join(__dirname, `migrations/*.${fileExt}`),
  ],

  migrationsTableName: 'migrations',
  synchronize: false,
  logging: ['error', 'migration'], // Helpful for debugging
});