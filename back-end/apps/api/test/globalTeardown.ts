import { StartedTestContainer } from 'testcontainers';

import { getFormattedFullTime } from './utils/timeUtils';

export default async function globalTeardown() {
  console.log(`${getFormattedFullTime(new Date())} Global teardown started`);

  /* Stops the Redis, Postgres, RabbitMQ containers */
  const result = await Promise.allSettled([
    stopContainer(global.REDIS_CONTAINER),
    stopContainer(global.POSTGRES_CONTAINER),
    stopContainer(global.RABBITMQ_CONTAINER),
  ]);

  result.forEach((res, i) => {
    if (res.status === 'rejected') {
      console.error(`Error stopping container ${i}: ${res.reason}`);
    }
  });
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
