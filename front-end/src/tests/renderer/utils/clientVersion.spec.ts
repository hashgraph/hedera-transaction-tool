import { describe, expect, test } from 'vitest';
import type { IClient } from '@shared/interfaces/organization/user';
import { getLatestClient } from '@renderer/utils/clientVersion';

const createClient = (overrides: Partial<IClient> = {}): IClient => ({
  id: 1,
  version: '1.0.0',
  updateAvailable: false,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

describe('getLatestClient', () => {
  test('Returns null for undefined clients', () => {
    expect(getLatestClient(undefined)).toBeNull();
  });

  test('Returns null for null clients', () => {
    expect(getLatestClient(null)).toBeNull();
  });

  test('Returns null for empty array', () => {
    expect(getLatestClient([])).toBeNull();
  });

  test('Returns the single client when only one exists', () => {
    const client = createClient({ id: 1, version: '1.0.0' });
    expect(getLatestClient([client])).toEqual(client);
  });

  test('Returns the most recently updated client', () => {
    const older = createClient({ id: 1, version: '1.0.0', updatedAt: '2025-01-01T00:00:00.000Z' });
    const newer = createClient({ id: 2, version: '2.0.0', updatedAt: '2025-06-15T00:00:00.000Z' });

    expect(getLatestClient([older, newer])).toEqual(newer);
    expect(getLatestClient([newer, older])).toEqual(newer);
  });

  test('Returns the most recently updated client among multiple', () => {
    const oldest = createClient({
      id: 1,
      version: '1.0.0',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    const middle = createClient({
      id: 2,
      version: '1.5.0',
      updatedAt: '2025-06-01T00:00:00.000Z',
    });
    const newest = createClient({
      id: 3,
      version: '2.0.0',
      updatedAt: '2025-12-01T00:00:00.000Z',
    });

    expect(getLatestClient([oldest, middle, newest])).toEqual(newest);
    expect(getLatestClient([newest, oldest, middle])).toEqual(newest);
    expect(getLatestClient([middle, newest, oldest])).toEqual(newest);
  });

  test('Returns the first client when all have the same updatedAt', () => {
    const date = '2025-06-01T00:00:00.000Z';
    const clientA = createClient({ id: 1, version: '1.0.0', updatedAt: date });
    const clientB = createClient({ id: 2, version: '2.0.0', updatedAt: date });

    expect(getLatestClient([clientA, clientB])).toEqual(clientA);
  });

  test('Preserves updateAvailable property on returned client', () => {
    const client = createClient({ id: 1, version: '1.0.0', updateAvailable: true });
    const result = getLatestClient([client]);

    expect(result).toEqual(client);
    expect(result!.updateAvailable).toBe(true);
  });

  test('Returns the most recently updated client regardless of version number', () => {
    const newerVersion = createClient({
      id: 1,
      version: '2.0.0',
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    const olderVersionButMoreRecent = createClient({
      id: 2,
      version: '1.0.0',
      updatedAt: '2025-12-01T00:00:00.000Z',
    });

    expect(getLatestClient([newerVersion, olderVersionButMoreRecent])).toEqual(
      olderVersionButMoreRecent,
    );
  });

  test('Handles clients with updateAvailable set to different values', () => {
    const clientWithUpdate = createClient({
      id: 1,
      version: '1.0.0',
      updateAvailable: true,
      updatedAt: '2025-01-01T00:00:00.000Z',
    });
    const clientWithoutUpdate = createClient({
      id: 2,
      version: '2.0.0',
      updateAvailable: false,
      updatedAt: '2025-12-01T00:00:00.000Z',
    });

    const result = getLatestClient([clientWithUpdate, clientWithoutUpdate]);
    expect(result).toEqual(clientWithoutUpdate);
    expect(result!.updateAvailable).toBe(false);
  });

  test('Handles ISO date strings with different timezones correctly', () => {
    const clientA = createClient({
      id: 1,
      version: '1.0.0',
      updatedAt: '2025-06-01T23:59:59.000Z',
    });
    const clientB = createClient({
      id: 2,
      version: '2.0.0',
      updatedAt: '2025-06-02T00:00:00.000Z',
    });

    expect(getLatestClient([clientA, clientB])).toEqual(clientB);
  });
});
