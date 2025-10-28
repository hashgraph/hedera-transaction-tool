import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

import { LoggerMiddleware, NOTIFICATIONS_SERVICE } from '@app/common';
import { RedisIoAdapter } from './websocket/redis-io.adapter';

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

  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [configService.getOrThrow<string>('RABBITMQ_URI')],
      queue: NOTIFICATIONS_SERVICE,
      queueOptions: {
        durable: true,
        arguments: {
          'x-queue-type': 'quorum',
        },
      },
      noAck: false,
      prefetchCount: 1,
    },
  });
}
