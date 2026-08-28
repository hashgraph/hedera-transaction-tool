import { ExceptionFilter, Catch, ArgumentsHost, NotFoundException } from '@nestjs/common';
import { Response } from 'express';

// No logging here: this filter catches every NotFoundException, including ones services
// throw for legitimate "resource not found" cases (see e.g. ReviewerGroupsService), not
// just genuinely unmatched routes. LoggerMiddleware already logs every request, 404s
// included, at WARN -- adding a second log line here would both duplicate that and
// mislabel those business-logic 404s as unmatched routes.
@Catch(NotFoundException)
export class NotFoundExceptionFilter implements ExceptionFilter {
  catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: 'Route not found',
    });
  }
}
