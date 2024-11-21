import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';

import { version } from '../package.json';

import { API_SERVICE, ErrorCodes, LoggerMiddleware } from '@app/common';

import { NotFoundExceptionFilter } from './filters/not-found-exception.filter';
import { BadRequestExceptionFilter } from './filters/bad-request-exception.filter';

export function setupApp(app: NestExpressApplication, addLogger: boolean = true) {
  connectMicroservices(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory() {
        return new BadRequestException(ErrorCodes.IB);
      },
    }),
  );

  app.useGlobalFilters(new NotFoundExceptionFilter(), new BadRequestExceptionFilter());

  if (addLogger) {
    const loggerMiddleware = app.get(LoggerMiddleware);
    app.use(loggerMiddleware.use.bind(loggerMiddleware));
  }

  app.use(json({ limit: '2mb' }));
  app.enableCors({
    origin: true,
    credentials: true,
  });
}

function connectMicroservices(app: NestExpressApplication) {
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

export function setupSwagger(app: NestExpressApplication) {
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
}
