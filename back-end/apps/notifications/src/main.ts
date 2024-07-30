import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { NotificationsModule } from './notifications.module';

import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(NotificationsModule);

  setupApp(app);

  const configService = app.get(ConfigService);

  await app.startAllMicroservices();
  await app.listen(configService.get<string>('HTTP_PORT'));
}

bootstrap();
