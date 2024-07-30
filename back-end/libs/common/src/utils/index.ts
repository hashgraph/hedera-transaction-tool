export * from './buffer';
export * from './sdk';
export * from './mirrorNode';
export * from './model';
export * from './typeORM';
export * from './test';
export * from './transaction';

export const asyncFilter = async <T>(list: T[], predicate: (t: T) => Promise<boolean>) => {
  const resolvedPredicates = await Promise.all(list.map(predicate));
  return list.filter((item, idx) => resolvedPredicates[idx]);
};
