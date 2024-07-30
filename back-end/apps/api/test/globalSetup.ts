/* eslint-disable no-var */
import * as path from 'path';

import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { RabbitMQContainer } from '@testcontainers/rabbitmq';

import { addUsers } from './utils/databaseUtil';

export default async function globalSetup() {
  /* Starts the Redis, Postgres, RabbitMQ containers */
  await Promise.all([startRedis(), startPostgres(), startRabbitMQ()]);

  /* Add Users to the database */
  await addUsers();

  /* Start the Notifications, Chain Services */
  // await Promise.allSettled([startNotificationsService(), startChainService()]);

  console.log('Global setup completed!');
}

async function startRedis() {
  /* For more information visit: https://node.testcontainers.org/modules/redis/ */
  const containerName = 'Redis';

  console.log(`Starting ${containerName} container...`);
  global.REDIS_CONTAINER = await new RedisContainer().withName(containerName).start();
  console.log(`${containerName} container started at ${global.REDIS_CONTAINER.getConnectionUrl()}`);

  process.env.REDIS_GETAWAY = getGetawayFromTestContainer(global.REDIS_CONTAINER);
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

  process.env.POSTGRES_GETAWAY = getGetawayFromTestContainer(global.POSTGRES_CONTAINER);
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

  process.env.RABBITMQ_GATEWAY = getGetawayFromTestContainer(global.RABBITMQ_CONTAINER);
  process.env.RABBITMQ_URI = global.RABBITMQ_CONTAINER.getAmqpUrl();
}

async function startNotificationsService() {
  const containerName = 'Notifications_Service';

  console.log(`Starting ${containerName} container...`);

  const container = await GenericContainer.fromDockerfile(
    path.join(__dirname, '../../../'),
    'apps/notifications/Dockerfile',
  )
    .withTarget('development')
    .build();

  const startedContainer = await container
    .withName(containerName)
    .withCommand(['npm', 'run', 'start:dev', 'notifications'])
    .withEnvironment({
      HTTP_PORT: '3020',
      RABBITMQ_URI: process.env.RABBITMQ_URI.replace('localhost', process.env.RABBITMQ_GATEWAY),
      /* Non essential environment variables */
      AUTH_HOST: 'unknown', // This is not required as we won't be checking the token
      AUTH_PORT: '3001', // This is not required as we won't be checking the token
      BREVO_USERNAME: 'brevo_credentials', // This is not required as we are unable to check email
      BREVO_PASSWORD: 'brevo_credentials', // This is not required as we are unable to check email
    })
    .withExposedPorts(3020)
    .start();
  console.log('Started container:', startedContainer.getName());

  global.NOTIFICATIONS_SERVICE_CONTAINER = startedContainer;

  console.log(
    `${containerName} container started at ${global.NOTIFICATIONS_SERVICE_CONTAINER.getHost()}:${startedContainer.getMappedPort(3020)}`,
  );

  process.env.NOTIFICATIONS_SERVICE_URL = `http://${global.NOTIFICATIONS_SERVICE_CONTAINER.getHost()}:${startedContainer.getMappedPort(3020)}`;
}

async function startChainService() {
  const containerName = 'Chain_Service';

  console.log(`Starting ${containerName} container...`);

  const container = await GenericContainer.fromDockerfile(
    path.join(__dirname, '../../../'),
    'apps/chain/Dockerfile',
  )
    .withTarget('development')
    .build();

  const startedContainer = await container
    .withCommand(['npm', 'run', 'start:dev', 'chain'])
    .withEnvironment({
      RABBITMQ_URI: process.env.RABBITMQ_URI.replace('localhost', process.env.RABBITMQ_GATEWAY),
      REDIS_URL: process.env.REDIS_URL.replace('localhost', process.env.REDIS_GETAWAY),
      POSTGRES_HOST: process.env.POSTGRES_GETAWAY,
      POSTGRES_PORT: process.env.POSTGRES_PORT,
      POSTGRES_DATABASE: process.env.POSTGRES_DATABASE,
      POSTGRES_USERNAME: process.env.POSTGRES_USERNAME,
      POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
      POSTGRES_SYNCHRONIZE: 'true',
    })
    .start();
  console.log('Started container:', startedContainer.getName());

  global.CHAIN_SERVICE_CONTAINER = startedContainer;

  console.log(
    `${containerName} container started at ${global.CHAIN_SERVICE_CONTAINER.getHost()}:${startedContainer.getMappedPort(3020)}`,
  );

  process.env.CHAIN_SERVICE_URL = `http://${global.CHAIN_SERVICE_CONTAINER.getHost()}:${startedContainer.getMappedPort(3020)}`;
}

function getGetawayFromTestContainer(container: StartedTestContainer) {
  //@ts-expect-error - startedTestContainer is protected
  return container.startedTestContainer.inspectResult.NetworkSettings.Gateway;
}
