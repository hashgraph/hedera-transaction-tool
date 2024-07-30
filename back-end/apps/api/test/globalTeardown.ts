import { StartedTestContainer } from 'testcontainers';

export default async function globalTeardown() {
  /* Stops the Notifications, Chain Services */
  // const result = await Promise.allSettled([
  //   stopContainer(global.NOTIFICATIONS_SERVICE_CONTAINER),
  //   stopContainer(global.CHAIN_SERVICE_CONTAINER),
  // ]);

  /* Stops the Redis, Postgres, RabbitMQ containers */
  const result1 = await Promise.allSettled([
    stopContainer(global.REDIS_CONTAINER),
    stopContainer(global.POSTGRES_CONTAINER),
    stopContainer(global.RABBITMQ_CONTAINER),
  ]);

  // result.forEach((res, i) => {
  //   if (res.status === 'rejected') {
  //     console.error(`Error stopping container ${i}: ${res.reason}`);
  //   }
  // });

  result1.forEach((res, i) => {
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
