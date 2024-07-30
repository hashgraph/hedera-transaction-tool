/* eslint-disable no-var */
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { RabbitMQContainer } from '@testcontainers/rabbitmq';

import { addUsers } from './utils/databaseUtil';

export default async function globalSetup() {
  /* Starts the Redis, Postgres, RabbitMQ containers */
  await Promise.all([startRedis(), startPostgres(), startRabbitMQ()]);

  /* Add Users to the database */
  await addUsers();

  console.log('Global setup completed!');
}

async function startRedis() {
  /* For more information visit: https://node.testcontainers.org/modules/redis/ */
  const containerName = 'Redis';

  console.log(`Starting ${containerName} container...`);
  global.REDIS_CONTAINER = await new RedisContainer().withName(containerName).start();
  console.log(`${containerName} container started at ${global.REDIS_CONTAINER.getConnectionUrl()}`);

  process.env.REDIS_URL = global.REDIS_CONTAINER.getConnectionUrl();
}

async function startPostgres() {
  /* For more information visit: https://node.testcontainers.org/modules/postgresql/ */
  const containerName = 'Postgres';

  console.log(`Starting ${containerName} container...`);
  global.POSTGRES_CONTAINER = await new PostgreSqlContainer().withName(`${containerName}`).start();
  console.log(
    `${containerName} container started at ${global.POSTGRES_CONTAINER.getConnectionUri()}`,
  );

  process.env.POSTGRES_HOST = global.POSTGRES_CONTAINER.getHost();
  process.env.POSTGRES_PORT = global.POSTGRES_CONTAINER.getPort().toString();
  process.env.POSTGRES_DATABASE = global.POSTGRES_CONTAINER.getDatabase();
  process.env.POSTGRES_USERNAME = global.POSTGRES_CONTAINER.getUsername();
  process.env.POSTGRES_PASSWORD = global.POSTGRES_CONTAINER.getPassword();
}

async function startRabbitMQ() {
  /* For more information visit: https://node.testcontainers.org/modules/rabbitmq/ */
  const containerName = 'RabbitMQ';

  console.log(`Starting ${containerName} container...`);
  global.RABBITMQ_CONTAINER = await new RabbitMQContainer().withName(containerName).start();
  console.log(`${containerName} container started at ${global.RABBITMQ_CONTAINER.getAmqpUrl()}`);

  process.env.RABBITMQ_URI = global.RABBITMQ_CONTAINER.getAmqpUrl();
}
