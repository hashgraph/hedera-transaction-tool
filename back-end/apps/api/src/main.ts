import * as fs from 'fs';
import * as path from 'path';

import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { NestApplicationOptions, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import * as cookieParser from 'cookie-parser';

import { API_SERVICE } from '@app/common';

import { version } from '../package.json';

import { ApiModule } from './api.module';

async function bootstrap() {
  const app: NestExpressApplication = await createApp();

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
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Only saves values from the body that are listed in the dtos
      transform: true, // Allows the @Transform validation checks to save the transformed value
    }),
  );
  app.useLogger(app.get(Logger));

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Hedera Transaction Tool Backend API')
    .setDescription(
      'The Backend API module is used for authorization, authentication, pulling and saving transaction data.',
    )
    .setVersion(version)
    // .addServer('http://localhost:3000/', 'Local environment')
    // .addServer('https://staging.yourapi.com/', 'Staging')
    // .addServer('https://production.yourapi.com/', 'Production')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

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
  } catch (error) {
    console.log(error);
  }

  return (await NestFactory.create(ApiModule, options)) as NestExpressApplication;
}

bootstrap();
