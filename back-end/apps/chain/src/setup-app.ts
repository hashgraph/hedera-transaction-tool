import { INestApplication, ValidationPipe } from '@nestjs/common';

import { LoggerMiddleware } from '@app/common';

export function setupApp(app: INestApplication, addLogger: boolean = true) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  if (addLogger) {
    const loggerMiddleware = app.get(LoggerMiddleware);
    app.use(loggerMiddleware.use.bind(loggerMiddleware));
  }
}