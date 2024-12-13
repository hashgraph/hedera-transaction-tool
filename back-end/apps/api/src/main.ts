import * as fs from 'fs';
import * as path from 'path';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { NestApplicationOptions } from '@nestjs/common';

import { ApiModule } from './api.module';
import { setupApp, setupSwagger } from './setup-app';

async function bootstrap() {
  const app: NestExpressApplication = await createApp();

  setupApp(app);
  setupSwagger(app);

  const configService = app.get(ConfigService);

  await app.startAllMicroservices();
  await app.listen(configService.get<string>('HTTP_PORT'));
}

async function createApp(): Promise<NestExpressApplication> {
  if (process.env.NODE_ENV === 'production') {
    return await createAppForDeployment();
  } else {
    return await createAppForDevelopment();
  }
}

async function createAppForDeployment(): Promise<NestExpressApplication> {
  const app = (await NestFactory.create(ApiModule)) as NestExpressApplication;
  app.enable('trust proxy');

  return app;
}

async function createAppForDevelopment(): Promise<NestExpressApplication> {
  const options: NestApplicationOptions = {};
  try {
    const key = fs.readFileSync(path.resolve(__dirname, '../../../cert/key.pem'));
    const cert = fs.readFileSync(path.resolve(__dirname, '../../../cert/cert.pem'));
    options.httpsOptions = { key, cert };
  } catch {
    console.warn('No self-signed SSL certificate found. Running in HTTP mode.');
  }

  return (await NestFactory.create(ApiModule, options)) as NestExpressApplication;
}

bootstrap();
