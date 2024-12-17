import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

import { CHAIN_SERVICE, LoggerMiddleware } from '@app/common';

export function setupApp(app: INestApplication, addLogger: boolean = true) {
  connectMicroservices(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  if (addLogger) {
    const loggerMiddleware = app.get(LoggerMiddleware);
    app.use(loggerMiddleware.use.bind(loggerMiddleware));
  }
}

function connectMicroservices(app: INestApplication) {
  const configService = app.get(ConfigService);

  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [configService.getOrThrow<string>('RABBITMQ_URI')],
      queue: CHAIN_SERVICE,
    },
  });
}
