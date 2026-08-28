import { ExceptionFilter, Catch, ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { CLIENT_IP_KEY, sanitizeForLog } from '@app/common';

const MAX_URL_LOG_LENGTH = 2048;

@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnmatchedRoute');

  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const ip = request[CLIENT_IP_KEY];
    const logUrl =
      request.originalUrl.length > MAX_URL_LOG_LENGTH
        ? `${request.originalUrl.slice(0, MAX_URL_LOG_LENGTH)}... [truncated]`
        : request.originalUrl;

    this.logger.warn(sanitizeForLog(`UNMATCHED_ROUTE ${ip} ${request.method} ${logUrl}`));

    response.status(status).json({
      statusCode: status,
      message: 'Route not found',
    });
  }
}
