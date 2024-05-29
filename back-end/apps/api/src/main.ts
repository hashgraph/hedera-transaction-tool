import * as fs from 'fs';
import * as path from 'path';

import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { Logger } from 'nestjs-pino';

import { ApiModule } from './api.module';

import * as cookieParser from 'cookie-parser';
import { API_SERVICE } from '@app/common';

const { version } = require('../package.json');

async function bootstrap() {
  let app: INestApplication;

  if (process.env.NODE_ENV === 'production') {
    app = await NestFactory.create(ApiModule);
  } else {
    const httpsOptions = {
          key: fs.readFileSync(path.resolve(__dirname, '../../../cert/key.pem')),
          cert: fs.readFileSync(path.resolve(__dirname, '../../../cert/cert.pem')),
        };
    app = await NestFactory.create(ApiModule, { httpsOptions });
  }

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
bootstrap();
