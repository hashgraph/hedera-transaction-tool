export * from './buffer';
export * from './sdk';
export * from './mirrorNode';
export * from './model';
export * from './typeORM';
export * from './transaction';
export * from './user';
export * from './client';
export * from './safeAwait';
export * from './scheduler';
export * from './semver';

export const asyncFilter = async <T>(list: T[], predicate: (t: T) => Promise<boolean>) => {
  const resolvedPredicates = await Promise.all(list.map(predicate));
  return list.filter((item, idx) => resolvedPredicates[idx]);
};

export function maskSensitiveData(data, fieldsToMask: string[]) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const maskedData = { ...data };
  fieldsToMask.forEach(field => {
    if (maskedData[field]) {
      maskedData[field] = '****';
    }
  });

  return maskedData;
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
