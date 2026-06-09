import { ExceptionFilter, Catch, ArgumentsHost, Logger, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}`,
      (exception as any)?.stack ?? (exception as any)?.message ?? String(exception),
    );

    response.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
}
