import { expect } from 'vitest';

import fs from 'fs/promises';

import {
  JSONtoUInt8Array,
  deleteDirectory,
  getNumberArrayFromString,
  saveContentToPath,
} from '@main/utils';

describe('General utilities', () => {
  test('getNumberArrayFromString: Returns correct numbers array from string', () => {
    const numbers = '1,4,2,5,1,2,6,83,2';

    const array = getNumberArrayFromString(numbers);

    expect(array).toEqual([1, 4, 2, 5, 1, 2, 6, 83, 2]);
  });

  test('JSONtoUInt8Array: Returns correct Uint8Array', () => {
    const jsonObject = {
      important: 'property',
      this: {
        is: {
          nested: 'property',
        },
      },
    };

    const uint8Array = JSONtoUInt8Array(jsonObject);

    expect(uint8Array).toBeInstanceOf(Uint8Array);
  });

  test('saveContentToPath: Saves content to path', async () => {
    const filePath = './test.txt';
    const text = 'Test content';
    const content = Buffer.from(text);

    const result = await saveContentToPath(filePath, content);
    const savedContent = await fs.readFile(filePath);

    await fs.unlink(filePath);

    expect(savedContent.toString()).toEqual(text);
    expect(result).toBeTruthy();
  });

  test('saveContentToPath: Returns false if an error occurs', async () => {
    const filePath = '/root/test.txt';
    const text = 'Test content';
    const content = Buffer.from(text);

    const result = await saveContentToPath(filePath, content);

    expect(result).toBeFalsy();
  });

  test('deleteDirectory: Deletes directory', async () => {
    const directoryPath = './test';

    await fs.mkdir(directoryPath);
    const result = await deleteDirectory(directoryPath);

    expect(result).toBeTruthy();
  });

  test('deleteDirectory: Returns false if an error occurs', async () => {
    const directoryPath = './test';

    const result = await deleteDirectory(directoryPath);

    expect(result).toBeFalsy();
  });
});
