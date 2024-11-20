import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { ErrorCodes } from '@app/common';

export interface Filtering {
  property: string;
  rule: string;
  value: string;
  isDate?: boolean;
}

export enum FilterRule {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUALS = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUALS = 'lte',
  LIKE = 'like',
  NOT_LIKE = 'nlike',
  IN = 'in',
  NOT_IN = 'nin',
  IS_NULL = 'isnull',
  IS_NOT_NULL = 'isnotnull',
}

export const FilteringParams = createParamDecorator(
  (
    { validProperties, dateProperties }: { validProperties: string[]; dateProperties: string[] },
    ctx: ExecutionContext,
  ): Filtering[] => {
    const req: Request = ctx.switchToHttp().getRequest();

    if (!req.query.filter) return null;

    const filters: string[] = Array.isArray(req.query.filter)
      ? req.query.filter.map(f => f?.toString())
      : [req.query.filter?.toString()];

    if (!Array.isArray(validProperties)) throw new BadRequestException(ErrorCodes.IFP);

    const filtering: Filtering[] = [];

    for (const filter of filters) {
      filtering.push(parseFilter(filter, validProperties, dateProperties));
    }

    return filtering;
  },
);

function parseFilter(
  rawFilter: string,
  validProperties: string[],
  dateProperties: string[],
): Filtering {
  if (
    !rawFilter.match(
      /^[a-zA-Z0-9_]+:(eq|neq|gt|gte|lt|lte|like|nlike|in|nin):[a-zA-Z0-9_, -.:/]+$/,
    ) &&
    !rawFilter.match(/^[a-zA-Z0-9_]+:(isnull|isnotnull)$/)
  ) {
    throw new BadRequestException(ErrorCodes.IFP);
  }

  const [property, rule, ...value] = rawFilter.split(':');
  if (!validProperties.includes(property)) throw new BadRequestException(ErrorCodes.IFP);
  if (!Object.values(FilterRule).includes(rule as FilterRule))
    throw new BadRequestException(ErrorCodes.IFP);

  const filtering: Filtering = { property, rule, value: value.join(':') };

  if (dateProperties.includes(property)) {
    filtering.isDate = true;
  }

  return filtering;
}
