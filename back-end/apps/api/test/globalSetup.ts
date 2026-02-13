import { exec } from 'child_process';
import * as util from 'util';

import { StartedTestContainer } from 'testcontainers';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { RabbitMQContainer } from '@testcontainers/rabbitmq';

import { addUsers } from './utils/databaseUtil';

const execPromise = util.promisify(exec);

const redisContainerName = 'Redis';
const postgresContainerName = 'Postgres';
const rabbitMQContainerName = 'RabbitMQ';

export default async function globalSetup() {
  /* Stops the containers if they are already running */
  await Promise.allSettled([
    deleteContainersByName('Redis'),
    deleteContainersByName('Postgres'),
    deleteContainersByName('RabbitMQ'),
    deleteContainersByName('Notifications_Service'),
    deleteContainersByName('Chain_Service'),
  ]);

  /* Starts the Redis, Postgres, RabbitMQ containers */
  await Promise.all([startRedis(), startPostgres(), startRabbitMQ()]);

  /* Add Users to the database */
  await addUsers();

  /* Start the Hedera Localnet */
  await startHederaLocalnet();

  /* Start the Notifications, Chain Services */
  // await Promise.allSettled([startNotificationsService(), startChainService()]);

  console.log('Global setup completed!');
}

async function startRedis() {
  /* For more information visit: https://node.testcontainers.org/modules/redis/ */
  console.log(`Starting ${redisContainerName} container...`);
  global.REDIS_CONTAINER = await new RedisContainer().withName(redisContainerName).start();
  console.log(
    `${redisContainerName} container started at ${global.REDIS_CONTAINER.getConnectionUrl()}`,
  );

  process.env.REDIS_GETAWAY = getGetawayFromTestContainer(global.REDIS_CONTAINER);
  process.env.REDIS_URL = global.REDIS_CONTAINER.getConnectionUrl();
}

async function startPostgres() {
  /* For more information visit: https://node.testcontainers.org/modules/postgresql/ */
  console.log(`Starting ${postgresContainerName} container...`);
  global.POSTGRES_CONTAINER = await new PostgreSqlContainer()
    .withName(`${postgresContainerName}`)
    .start();
  console.log(
    `${postgresContainerName} container started at ${global.POSTGRES_CONTAINER.getConnectionUri()}`,
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
  console.log(`Starting ${rabbitMQContainerName} container...`);
  global.RABBITMQ_CONTAINER = await new RabbitMQContainer().withName(rabbitMQContainerName).start();
  console.log(
    `${rabbitMQContainerName} container started at ${global.RABBITMQ_CONTAINER.getAmqpUrl()}`,
  );

  process.env.RABBITMQ_GATEWAY = getGetawayFromTestContainer(global.RABBITMQ_CONTAINER);
  process.env.RABBITMQ_URI = global.RABBITMQ_CONTAINER.getAmqpUrl();
}

async function startHederaLocalnet() {
  console.log('Starting Hedera Localnet...');

  try {
    await execPromise(`hedera start -d`);
    console.log('Hedera Localnet started');
  } catch (error) {
    console.log('Error starting Hedera Localnet:');
    console.log(error);
  }
}

function getGetawayFromTestContainer(container: StartedTestContainer) {
  //@ts-expect-error - startedTestContainer is protected
  return container.startedTestContainer.inspectResult.NetworkSettings.Gateway;
}

async function deleteContainersByName(containerName) {
  const { stdout } = await execPromise(
    `docker ps --filter "name=${containerName}" --format "{{.ID}}"`,
  );

  const containerIds = stdout.split('\n').filter(id => id);

  if (containerIds.length === 0) {
    console.log('No containers found with the specified name.');
    return;
  }

  for (const id of containerIds) {
    try {
      await execPromise(`docker stop ${id}`);
      console.log(`Stopped container ${id}`);
      await execPromise(`docker rm ${id}`);
      console.log(`Deleted container ${id}`);
    } catch (error) {
      console.error(`Error deleting container ${id}: ${error}`);
    }
  }
}
