// import { exec } from 'child_process';
// import * as util from 'util';

import { StartedTestContainer } from 'testcontainers';

// const execPromise = util.promisify(exec);

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

  /* Stops the Hedera Localnet */
  try {
    // await stopHederaLocalnet();
  } catch (error) {
    console.log(error);
  }
}

async function stopContainer(container: StartedTestContainer) {
  const name = container.getName().slice(1);

  console.log(`Stopping ${name} container...`);
  try {
    await container.stop();
    console.log(`${name} container stopped`);
  } catch (error) {
    console.error(`Error stopping container: ${error}`);
  }
}

// async function stopHederaLocalnet() {
//   console.log('Stopping Hedera Localnet...');

//   try {
//     await execPromise(`hedera stop -d`);
//     console.log('Hedera Localnet stopped');
//   } catch (error) {
//     console.log('Error stopping Hedera Localnet');
//     console.log(error);
//   }
// }
