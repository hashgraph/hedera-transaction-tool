import { ErrorCodes } from '@app/common';
import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { Response } from 'express';

const KNOWN_ERROR_CODES = new Set<string>(Object.values(ErrorCodes));

@Catch(BadRequestException)
export class BadRequestExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BadRequestExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const isErrorCode = KNOWN_ERROR_CODES.has(exception.message);

    if (!isErrorCode) {
      // The client only ever sees ErrorCodes.UNKWN for these, so log the real
      // message/stack here or it's lost entirely.
      this.logger.error(
        `Unmapped BadRequestException surfaced as UNKWN: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      message: 'The request is invalid. Please check the request body and try again.',
      code: isErrorCode ? exception.message : ErrorCodes.UNKWN,
    });
  }
}
