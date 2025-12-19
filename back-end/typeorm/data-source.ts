import { DataSource } from 'typeorm';
import { join } from 'path';

const isCompiled = __dirname.includes('/dist/');

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
      __dirname,
      isCompiled ? '../libs/**/*.entity.js' : '../libs/**/*.entity.ts'
    ),
  ],

  // Migrations: .ts in dev (with ts-node), .js in production
  migrations: [
    join(__dirname, 'migrations', isCompiled ? '*.js' : '*.ts'),
  ],

  migrationsTableName: 'migrations',
  synchronize: false,
  logging: ['error', 'migration'], // Helpful for debugging
});