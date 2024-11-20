import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { maskSensitiveData } from '@app/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  use(req, res, next: () => void) {
    const { method, originalUrl, body = {}, query = {} } = req;
    const start = Date.now();

    const maskedBody = maskSensitiveData(body, ['password', 'email']);
    const maskedQuery = maskSensitiveData(query, ['token']);

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      const payload =
        Object.keys(maskedBody).length || Object.keys(maskedQuery).length
          ? ` - Payload: ${JSON.stringify({ body: maskedBody, query: maskedQuery })}`
          : '';
      this.logger.info(`${method} ${originalUrl} ${statusCode} - ${duration}ms${payload}`);
    });

    next();
  }
}
