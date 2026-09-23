import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, NextFunction, Request, Response } from 'express';

import { version } from '../package.json';

import { ClientIpMiddleware, ErrorCodes, LoggerMiddleware } from '@app/common';

import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { NotFoundExceptionFilter } from './filters/not-found-exception.filter';
import { BadRequestExceptionFilter } from './filters/bad-request-exception.filter';

export function setupApp(app: NestExpressApplication, addLogger: boolean = true) {
  connectMicroservices(app);

  // Resolve the client IP first, before anything else touches the request -- guards,
  // pipes, and the logger below all rely on req[CLIENT_IP_KEY] being set.
  const clientIpMiddleware = app.get(ClientIpMiddleware);
  app.use(clientIpMiddleware.use.bind(clientIpMiddleware));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory(errors: ValidationError[]) {
        console.error(
          'Validation failed:',
          errors.map((error) => ({
            property: error.property,
            type: error.target?.constructor?.name || 'Unknown', // Logs the type being validated
            valueKeys: error.value ? Object.keys(error.value) : [], // Logs the keys of the value
          })),
        );
        return new BadRequestException(ErrorCodes.IB);
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(), new NotFoundExceptionFilter(), new BadRequestExceptionFilter());

  const configService = app.get(ConfigService);
  const jsonBodyLimit = configService.get<string>('JSON_BODY_LIMIT', { infer: true }) || '2mb';
  const transactionGroupsJsonBodyLimit =
    configService.get<string>('TRANSACTION_GROUPS_JSON_BODY_LIMIT', { infer: true }) || '25mb';

  // Registered before the catch-all: body-parser marks the body as parsed on first pass, so
  // once one json() middleware has run, a later one for the same request just no-ops instead
  // of re-checking size. Gated to POST specifically -- app.use() path matching is method-
  // agnostic, and GET /transaction-groups/:id / PATCH /transaction-groups/:id/cancel don't
  // read a body, so they should fall through to the smaller default like every other route.
  const transactionGroupsJsonParser = json({ limit: transactionGroupsJsonBodyLimit });
  app.use('/transaction-groups', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST') {
      transactionGroupsJsonParser(req, res, next);
    } else {
      next();
    }
  });
  app.use(json({ limit: jsonBodyLimit }));

  if (addLogger) {
    const loggerMiddleware = app.get(LoggerMiddleware);
    app.use(loggerMiddleware.use.bind(loggerMiddleware));
  }
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
}

export type SwaggerMode = 'off' | 'docs' | 'live';

// Deliberately independent of NODE_ENV: several deployments (e.g. staging) set
// NODE_ENV=production to get the correct SSL/trust-proxy/bootstrap behavior in
// main.ts, which previously also suppressed Swagger there as a side effect.
export function getSwaggerMode(configService: ConfigService): SwaggerMode {
  return (configService.get<string>('SWAGGER_MODE', { infer: true }) as SwaggerMode) ?? 'off';
}

export function setupSwagger(app: NestExpressApplication, mode: Exclude<SwaggerMode, 'off'>) {
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
  SwaggerModule.setup('api-docs', app, document, {
    // 'docs' hides "Try it out" (supportedSubmitMethods: []) so the schema is
    // browsable without letting a visitor fire live requests through the UI.
    swaggerOptions: mode === 'docs' ? { supportedSubmitMethods: [] } : undefined,
  });
}
