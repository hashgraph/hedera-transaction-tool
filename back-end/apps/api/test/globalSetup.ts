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
// const notificationsServiceContainerName = 'Notifications_Service';
// const chainServiceContainerName = 'Chain_Service';

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

// async function startNotificationsService() {
//   console.log(`Starting ${notificationsServiceContainerName} container...`);

//   const container = await GenericContainer.fromDockerfile(
//     path.join(__dirname, '../../../'),
//     'apps/notifications/Dockerfile',
//   )
//     .withTarget('development')
//     .build();

//   const startedContainer = await container
//     .withName(notificationsServiceContainerName)
//     .withCommand(['npm', 'run', 'start:dev', 'notifications'])
//     .withEnvironment({
//       HTTP_PORT: '3020',
//       RABBITMQ_URI: process.env.RABBITMQ_URI.replace('localhost', process.env.RABBITMQ_GATEWAY),
//       /* Non essential environment variables */
//       AUTH_HOST: 'unknown', // This is not required as we won't be checking the token
//       AUTH_PORT: '3001', // This is not required as we won't be checking the token
//       BREVO_USERNAME: 'brevo_credentials', // This is not required as we are unable to check email
//       BREVO_PASSWORD: 'brevo_credentials', // This is not required as we are unable to check email
//     })
//     .withExposedPorts(3020)
//     .start();
//   console.log('Started container:', startedContainer.getName());

//   global.NOTIFICATIONS_SERVICE_CONTAINER = startedContainer;

//   console.log(
//     `${notificationsServiceContainerName} container started at ${global.NOTIFICATIONS_SERVICE_CONTAINER.getHost()}:${startedContainer.getMappedPort(3020)}`,
//   );

//   process.env.NOTIFICATIONS_SERVICE_URL = `http://${global.NOTIFICATIONS_SERVICE_CONTAINER.getHost()}:${startedContainer.getMappedPort(3020)}`;
// }

// async function startChainService() {
//   console.log(`Starting ${chainServiceContainerName} container...`);

//   const container = await GenericContainer.fromDockerfile(
//     path.join(__dirname, '../../../'),
//     'apps/chain/Dockerfile',
//   )
//     .withTarget('development')
//     .build();

//   const startedContainer = await container
//     .withCommand(['npm', 'run', 'start:dev', 'chain'])
//     .withEnvironment({
//       RABBITMQ_URI: process.env.RABBITMQ_URI.replace('localhost', process.env.RABBITMQ_GATEWAY),
//       REDIS_URL: process.env.REDIS_URL.replace('localhost', process.env.REDIS_GETAWAY),
//       POSTGRES_HOST: process.env.POSTGRES_GETAWAY,
//       POSTGRES_PORT: process.env.POSTGRES_PORT,
//       POSTGRES_DATABASE: process.env.POSTGRES_DATABASE,
//       POSTGRES_USERNAME: process.env.POSTGRES_USERNAME,
//       POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
//       POSTGRES_SYNCHRONIZE: 'true',
//     })
//     .start();
//   console.log('Started container:', startedContainer.getName());

//   global.CHAIN_SERVICE_CONTAINER = startedContainer;

//   console.log(
//     `${chainServiceContainerName} container started at ${global.CHAIN_SERVICE_CONTAINER.getHost()}:${startedContainer.getMappedPort(3020)}`,
//   );

//   process.env.CHAIN_SERVICE_URL = `http://${global.CHAIN_SERVICE_CONTAINER.getHost()}:${startedContainer.getMappedPort(3020)}`;
// }

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
