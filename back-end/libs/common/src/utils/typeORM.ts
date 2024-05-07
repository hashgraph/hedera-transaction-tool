import {
  IsNull,
  Not,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  ILike,
  In,
  FindOptionsWhere,
} from 'typeorm';

import { Sorting } from '../decorators/sorting-params.decorator';
import { FilterRule, Filtering } from '../decorators/filtering-params.decorator';

export const getOrder = (sort: Sorting[]) => {
  const order = {};

  if (!sort || !sort.length) return order;

  sort.forEach(s => {
    order[s.property] = s.direction;
  });

  return order;
};

export const getWhere = <T>(filters: Filtering[]): FindOptionsWhere<T> => {
  const where: FindOptionsWhere<T> = {};

  if (!filters || !filters.length) return where;

  for (const filter of filters) {
    Object.assign(where, getFiltering(filter));
  }

  return where;
};

function getFiltering(filter: Filtering) {
  if (!filter) return {};

  const value = filter.isDate
    ? new Date(Number(decodeURIComponent(filter.value)))
    : decodeURIComponent(filter.value);

  switch (filter.rule) {
    case FilterRule.IS_NULL:
      return { [filter.property]: IsNull() };
    case FilterRule.IS_NOT_NULL:
      return { [filter.property]: Not(IsNull()) };
    case FilterRule.EQUALS:
      return { [filter.property]: value };
    case FilterRule.NOT_EQUALS:
      return { [filter.property]: Not(value) };
    case FilterRule.GREATER_THAN:
      return { [filter.property]: MoreThan(value) };
    case FilterRule.GREATER_THAN_OR_EQUALS:
      return { [filter.property]: MoreThanOrEqual(value) };
    case FilterRule.LESS_THAN:
      return { [filter.property]: LessThan(value) };
    case FilterRule.LESS_THAN_OR_EQUALS:
      return { [filter.property]: LessThanOrEqual(value) };
    case FilterRule.LIKE:
      return { [filter.property]: ILike(`%${value}%`) };
    case FilterRule.NOT_LIKE:
      return { [filter.property]: Not(ILike(`%${value}%`)) };
    case FilterRule.IN:
      return { [filter.property]: In(decodeURIComponent(filter.value).split(',')) };
    case FilterRule.NOT_IN:
      return { [filter.property]: Not(In(decodeURIComponent(filter.value).split(','))) };
  }
}
