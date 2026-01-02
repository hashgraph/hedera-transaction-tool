import { isFresh } from '@app/common';

describe('isFresh', () => {
  const THRESHOLD = 10_000;

  it('returns false when lastCheckedAt is null', () => {
    expect(isFresh(null, THRESHOLD)).toBe(false);
  });

  it('returns false when lastCheckedAt is undefined', () => {
    expect(isFresh(undefined, THRESHOLD)).toBe(false);
  });

  it('returns true when lastCheckedAt is within the threshold', () => {
    const lastCheckedAt = new Date(Date.now() - 5_000); // 5 seconds ago

    expect(isFresh(lastCheckedAt, THRESHOLD)).toBe(true);
  });

  it('returns false when lastCheckedAt is exactly at the threshold', () => {
    const lastCheckedAt = new Date(Date.now() - THRESHOLD);

    expect(isFresh(lastCheckedAt, THRESHOLD)).toBe(false);
  });

  it('returns false when lastCheckedAt is older than the threshold', () => {
    const lastCheckedAt = new Date(Date.now() - 15_000); // 15 seconds ago

    expect(isFresh(lastCheckedAt, THRESHOLD)).toBe(false);
  });
});