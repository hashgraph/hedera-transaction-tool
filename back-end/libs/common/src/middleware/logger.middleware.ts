import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CLIENT_IP_KEY, maskSensitiveData } from '@app/common';

const MAX_URL_LOG_LENGTH = 2048;

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  use(req, res, next: () => void) {
    const { method, originalUrl, body = {}, query = {} } = req;
    const start = Date.now();

    const ip = req[CLIENT_IP_KEY];

    const maskedBody = maskSensitiveData(body, ['password', 'newPassword', 'email', 'token', 'otp']);
    const maskedQuery = maskSensitiveData(query, ['token']);

    const maxPayloadLength = Number(process.env.LOG_PAYLOAD_MAX_LENGTH ?? 2000);
    const logUrl =
      originalUrl.length > MAX_URL_LOG_LENGTH
        ? `${originalUrl.slice(0, MAX_URL_LOG_LENGTH)}... [truncated]`
        : originalUrl;

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      const uid = req.user?.id != null ? `uid=${req.user.id}` : 'uid=-';
      let payload = '';
      if (Object.keys(maskedBody as object).length || Object.keys(maskedQuery as object).length) {
        const serialized = JSON.stringify({ body: maskedBody, query: maskedQuery });
        const truncated =
          serialized.length > maxPayloadLength
            ? `${serialized.slice(0, maxPayloadLength)}... [truncated]`
            : serialized;
        payload = ` - Payload: ${truncated}`;
      }
      this.logger.info(`${ip} ${uid} ${method} ${logUrl} ${statusCode} - ${duration}ms${payload}`);
    });

    next();
  }
}
