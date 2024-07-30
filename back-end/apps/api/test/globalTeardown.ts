import { StartedTestContainer } from 'testcontainers';

export default async function globalTeardown() {
  /* Stops the Redis, Postgres, RabbitMQ containers */
  await Promise.allSettled([
    stopContainer(global.REDIS_CONTAINER),
    stopContainer(global.POSTGRES_CONTAINER),
    stopContainer(global.RABBITMQ_CONTAINER),
  ]);
}

async function stopContainer(container: StartedTestContainer) {
  const name = container.getName().slice(1);

  console.log(`Stopping ${name} container...`);
  try {
    await container.stop();
    console.log(`${name} container stopped!`);
  } catch (error) {
    console.error(`Error stopping container: ${error}`);
  }
}
