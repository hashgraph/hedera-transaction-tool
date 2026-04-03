import _ from 'lodash';
import Diff from 'deep-diff';

export function compareJsonFiles(
  jsonData1: Record<string, unknown>,
  jsonData2: Record<string, unknown>,
  keysToIgnore: string[] = [],
) {
  const jsonData1Cleaned = removeKeys(jsonData1, keysToIgnore);
  const jsonData2Cleaned = removeKeys(jsonData2, keysToIgnore);
  const isEqual = _.isEqual(jsonData1Cleaned, jsonData2Cleaned);

  if (isEqual) {
    return null;
  }

  return Diff.diff(jsonData1Cleaned, jsonData2Cleaned);
}

export function removeKeys(obj: any, keysToRemove: string[]): any {
  if (Array.isArray(obj)) {
    return obj.map(item => removeKeys(item, keysToRemove));
  }

  if (typeof obj === 'object' && obj !== null) {
    return Object.keys(obj).reduce((acc: Record<string, unknown>, key: string) => {
      if (!keysToRemove.includes(key)) {
        acc[key] = removeKeys(obj[key], keysToRemove);
      }

      return acc;
    }, {});
  }

  return obj;
}

export function parsePropertiesContent(content: string): Record<string, unknown> {
  const lines = content.split('\n');
  const obj: Record<string, unknown> = {};

  lines.forEach(line => {
    line = line.trim();

    if (line && !line.startsWith('#')) {
      const index = line.indexOf('=');

      if (index > -1) {
        const key = line.substring(0, index).trim();
        obj[key] = line.substring(index + 1).trim();
      }
    }
  });

  return obj;
}
