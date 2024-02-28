import { expect } from 'vitest';

import { JSONtoUInt8Array, getNumberArrayFromString } from '@main/utils';

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

    expectTypeOf(uint8Array).toEqualTypeOf<Uint8Array>();
  });
});
