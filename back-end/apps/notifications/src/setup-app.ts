import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LoggerMiddleware, NatsReconnectService, NOTIFICATIONS_SERVICE } from '@app/common';
import { RedisIoAdapter } from './websocket/redis-io.adapter';
import { randomUUID } from 'crypto';

export function setupApp(app: INestApplication, addLogger: boolean = true) {
  const configService = app.get(ConfigService);

  connectMicroservices(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Only saves values from the body that are listed in the dtos
    }),
  );

  if (addLogger) {
    const loggerMiddleware = app.get(LoggerMiddleware);
    app.use(loggerMiddleware.use.bind(loggerMiddleware));
  }

  const redisIoAdapter = new RedisIoAdapter(app);
  redisIoAdapter.connectToRedis(configService.getOrThrow<string>('REDIS_URL'));

  app.useWebSocketAdapter(redisIoAdapter);
}

function connectMicroservices(app: INestApplication) {
  const configService = app.get(ConfigService);
  const natsReconnect = app.get(NatsReconnectService);

  natsReconnect.initialize(app, configService);

  // Fanout consumer (all instances receive messages)
  natsReconnect.connectMicroservice('notifications-fanout', {
    consumer: {
      name: `${NOTIFICATIONS_SERVICE}-fanout-${randomUUID()}`,
      durable: true,
      ackPolicy: 'Explicit',
      maxAckPending: 100,
      deliverPolicy: 'New',
    },
    stream: {
      name: 'NOTIFICATIONS_FANOUT',
      subjects: ['notifications.fanout.*'],
    },
  });

  // Queue consumer (load balanced across instances)
  natsReconnect.connectMicroservice('notifications-queue', {
    queue: NOTIFICATIONS_SERVICE,
    consumer: {
      deliverGroup: NOTIFICATIONS_SERVICE,
      durable: true,
      ackPolicy: 'Explicit',
      maxAckPending: 100,
    },
    stream: {
      name: 'NOTIFICATIONS_QUEUE',
      subjects: ['notifications.queue.*'],
    },
  });
}
