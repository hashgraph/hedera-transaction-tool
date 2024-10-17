import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { ErrorCodes } from '@app/common';

export interface Sorting {
  property: string;
  direction: string;
}

export const SortingParams = createParamDecorator(
  (validProperties, ctx: ExecutionContext): Sorting[] => {
    const req: Request = ctx.switchToHttp().getRequest();

    if (!req.query.sort) return null;

    const sort: string[] = Array.isArray(req.query.sort)
      ? req.query.sort.map(f => f?.toString())
      : [req.query.sort?.toString()];

    if (!sort) return null;

    if (!Array.isArray(validProperties)) throw new BadRequestException(ErrorCodes.ISP);

    const sorting: Sorting[] = [];

    for (const s of sort) {
      sorting.push(parseSort(s, validProperties));
    }

    return sorting;
  },
);

function parseSort(rawSort: string, validProperties: string[]): Sorting {
  const sortPattern = /^([a-zA-Z0-9]+):(asc|desc)$/;
  if (!rawSort.match(sortPattern)) throw new BadRequestException(ErrorCodes.ISP);

  const [property, direction] = rawSort.split(':');
  if (!validProperties.includes(property))
    throw new BadRequestException(`Invalid sort property: ${property}`);

  return { property, direction };
}
