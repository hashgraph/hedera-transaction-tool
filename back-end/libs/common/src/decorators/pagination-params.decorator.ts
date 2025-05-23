import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { ErrorCodes } from '@app/common';

export interface Pagination {
  page: number;
  limit: number;
  size: number;
  offset: number;
}

export const PaginationParams = createParamDecorator((data, ctx: ExecutionContext): Pagination => {
  const req: Request = ctx.switchToHttp().getRequest();
  const page = parseInt(req.query.page as string);
  const size = parseInt(req.query.size as string);

  if (isNaN(page) || page <= 0 || isNaN(size) || size < 0) {
    throw new BadRequestException(ErrorCodes.IPP);
  }

  if (size > 100) {
    throw new BadRequestException(ErrorCodes.IPP);
  }

  // calculate pagination parameters
  const limit = size;
  const offset = (page - 1) * limit;
  return { page, limit, size, offset };
});
