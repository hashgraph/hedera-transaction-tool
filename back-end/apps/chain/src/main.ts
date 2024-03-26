import { NestFactory } from '@nestjs/core';
import { ChainModule } from './chain.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(ChainModule);
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  await app.listen(configService.getOrThrow('HTTP_PORT'));
}
bootstrap();
