export * from './buffer';
export * from './sanitizeForLog';
export * from './sdk';
export * from './mirrorNode';
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

export function maskSensitiveData(data: unknown, fieldsToMask: string[]): unknown {
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, fieldsToMask));
  }

  if (!data || typeof data !== 'object') {
    return data;
  }

  const maskedData = { ...(data as Record<string, unknown>) };
  for (const key of Object.keys(maskedData)) {
    if (fieldsToMask.includes(key)) {
      maskedData[key] = '****';
    } else {
      maskedData[key] = maskSensitiveData(maskedData[key], fieldsToMask);
    }
  }

  return maskedData;
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
