import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
// import { Logger } from 'nestjs-pino';

import * as cookieParser from 'cookie-parser';

import { API_SERVICE } from '@app/common';
import { ApiModule, config } from '../../src/api.module';

export const overrideConfigServiceProvider = (builder: TestingModuleBuilder) => {
  const configModule = ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '../../.env.test',
  });

  builder
    .overrideModule(config)
    .useModule(configModule)
    .overrideProvider(ConfigService)
    .useClass(configModule.exports![0]);
};

export const addUseMocker = (builder: TestingModuleBuilder) => {
  builder.useMocker(mocker => {
    if (mocker === Reflector) {
      return new Reflector();
    }
  });
};

export async function createNestApp() {
  const moduleFixtureBuilder = Test.createTestingModule({
    imports: [ApiModule],
  });

  // addUseMocker(moduleFixtureBuilder);
  // overrideConfigServiceProvider(moduleFixtureBuilder);

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
  await Promise.allSettled([app.getMicroservices().map(ms => ms.close())]);
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
  /* To check why TCP microservice is not closing */
  // app.connectMicroservice({
  //   transport: Transport.TCP,
  //   options: {
  //     host: '0.0.0.0',
  //     port: configService.getOrThrow<string>('TCP_PORT'),
  //   },
  // });
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [configService.getOrThrow<string>('RABBITMQ_URI')],
      queue: API_SERVICE,
    },
  });
}
