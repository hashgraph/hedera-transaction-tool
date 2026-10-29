import { describe, expect, test } from 'vitest';

import { mapWithConcurrency } from '@main/utils/concurrency';

describe('mapWithConcurrency', () => {
  test('preserves order and never exceeds the limit', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, async n => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, 5));
      inFlight--;
      return n * 2;
    });

    expect(result).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18]);
    expect(maxInFlight).toBe(3);
  });

  test('rejects and stops starting new tasks after a failure', async () => {
    const started: number[] = [];

    await expect(
      mapWithConcurrency([1, 2, 3, 4, 5, 6], 1, async n => {
        started.push(n);
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');

    expect(started).toEqual([1, 2]);
  });

  test('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 4, async n => n)).toEqual([]);
  });
});
