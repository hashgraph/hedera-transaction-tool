import { ErrorCodes, ErrorMessages } from '@app/common';
import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class BadRequestExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const isErrorCode = ErrorMessages[exception.message];

    response.status(status).json({
      statusCode: status,
      message: 'The request is invalid. Please check the request body and try again.',
      code: isErrorCode ? exception.message : ErrorCodes.UNKWN,
    });
  }
}
