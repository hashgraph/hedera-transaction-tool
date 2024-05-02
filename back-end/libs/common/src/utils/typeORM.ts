import {
  IsNull,
  Not,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  ILike,
  In,
} from 'typeorm';

import { Sorting } from '../decorators/sorting-params.decorator';
import { FilterRule, Filtering } from '../decorators/filtering-params.decorator';

export const getOrder = (sort: Sorting[]) => {
  const order = {};

  sort.forEach(s => {
    order[s.property] = s.direction;
  });

  return order;
};

export const getWhere = (filter: Filtering[][]) => {
  const where = [];

  if (!filter || !filter.length) return where;

  for (const filterAND of filter) {
    const filteringAND = {};

    for (const filter of filterAND) {
      Object.assign(filteringAND, getFiltering(filter));
    }

    where.push(filteringAND);
  }

  return where;
};

function getFiltering(filter: Filtering) {
  if (!filter) return {};

  const value = filter.isDate ? new Date(Number(filter.value)) : filter.value;

  if (filter.rule == FilterRule.IS_NULL) return { [filter.property]: IsNull() };
  if (filter.rule == FilterRule.IS_NOT_NULL) return { [filter.property]: Not(IsNull()) };
  if (filter.rule == FilterRule.EQUALS) return { [filter.property]: value };
  if (filter.rule == FilterRule.NOT_EQUALS) return { [filter.property]: Not(value) };
  if (filter.rule == FilterRule.GREATER_THAN) return { [filter.property]: MoreThan(value) };
  if (filter.rule == FilterRule.GREATER_THAN_OR_EQUALS)
    return {
      [filter.property]: MoreThanOrEqual(value),
    };
  if (filter.rule == FilterRule.LESS_THAN) return { [filter.property]: LessThan(value) };
  if (filter.rule == FilterRule.LESS_THAN_OR_EQUALS)
    return {
      [filter.property]: LessThanOrEqual(value),
    };
  if (filter.rule == FilterRule.LIKE) return { [filter.property]: ILike(`%${value}%`) };
  if (filter.rule == FilterRule.NOT_LIKE) return { [filter.property]: Not(ILike(`%${value}%`)) };
  if (filter.rule == FilterRule.IN) return { [filter.property]: In(filter.value.split(',')) };
  if (filter.rule == FilterRule.NOT_IN)
    return { [filter.property]: Not(In(filter.value.split(','))) };
}
