import { NestFactory } from '@nestjs/core';

import { ChainModule } from './chain.module';

import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(ChainModule);

  setupApp(app);

  await app.startAllMicroservices();
  await app.init();
}
bootstrap();
