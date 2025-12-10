import { DataSource } from 'typeorm';
import { join } from 'path';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  username: process.env.POSTGRES_USERNAME || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DATABASE || 'postgres',

  // Point to SOURCE .ts entity files
  entities: [
    join(__dirname, '../libs/**/*.entity.ts'),
  ],

  // Migrations as .ts files
  migrations: [
    join(__dirname, './migrations/*.ts'),
  ],

  migrationsTableName: 'migrations',
  synchronize: false,
});