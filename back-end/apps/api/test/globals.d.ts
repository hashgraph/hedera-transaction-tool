/* eslint-disable no-var */

import { StartedRedisContainer } from '@testcontainers/redis';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedRabbitMQContainer } from '@testcontainers/rabbitmq';

declare global {
  var REDIS_CONTAINER: StartedRedisContainer;
  var POSTGRES_CONTAINER: StartedPostgreSqlContainer;
  var RABBITMQ_CONTAINER: StartedRabbitMQContainer;
}
