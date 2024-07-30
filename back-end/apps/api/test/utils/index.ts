import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
// import { Logger } from 'nestjs-pino';

import * as cookieParser from 'cookie-parser';

import { API_SERVICE } from '@app/common';
import { ApiModule } from '../../src/api.module';

export async function createNestApp() {
  const moduleFixtureBuilder = Test.createTestingModule({
    imports: [ApiModule],
  });

  const moduleFixture = await moduleFixtureBuilder.compile();

  const app = moduleFixture.createNestApplication() as NestExpressApplication;

  setupApp(app);

  await app.startAllMicroservices();
  await app.init();

  return app;
}

export async function closeApp(app: NestExpressApplication) {
  if (!app) return;

  await app.close();
  const results = await Promise.allSettled([app.getMicroservices().map(ms => ms.close())]);

  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error('Error closing microservice', result.reason);
    }
  });
}

function setupApp(app: NestExpressApplication) {
  connectMicroservice(app);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: true,
    credentials: true,
  });
  // app.useLogger(app.get(Logger));
}

function connectMicroservice(app: NestExpressApplication) {
  const configService = app.get(ConfigService);
  app.connectMicroservice({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: configService.getOrThrow<string>('TCP_PORT'),
    },
  });
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [configService.getOrThrow<string>('RABBITMQ_URI')],
      queue: API_SERVICE,
    },
  });
}
