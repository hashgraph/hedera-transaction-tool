// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';

import useStoredTablePreferences from '@renderer/composables/useStoredTablePreferences';

const userStore: any = {
  personal: { id: 'user-1' },
  selectedOrganization: { serverUrl: 'https://org-a.example' },
};
vi.mock('@renderer/stores/storeUser', () => ({ default: () => userStore }));

const toSortField = (f: string) => (['created_at', 'valid_start'].includes(f) ? f : undefined);
const fallback = { field: 'valid_start', direction: 'asc' } as const;

describe('useStoredTablePreferences', () => {
  beforeEach(() => {
    localStorage.clear();
    userStore.personal = { id: 'user-1' };
    userStore.selectedOrganization = { serverUrl: 'https://org-a.example' };
  });

  test('round-trips saved values', () => {
    const prefs = useStoredTablePreferences('history');
    prefs.save('status-filter', ['EXECUTED']);
    expect(prefs.load('status-filter')).toEqual(['EXECUTED']);
  });

  test('scopes values per table, organization and user', () => {
    useStoredTablePreferences('history').save('x', [1]);

    expect(useStoredTablePreferences('ready').load('x')).toBeNull();

    userStore.selectedOrganization = { serverUrl: 'https://org-b.example' };
    expect(useStoredTablePreferences('history').load('x')).toBeNull();

    userStore.selectedOrganization = { serverUrl: 'https://org-a.example' };
    userStore.personal = { id: 'user-2' };
    expect(useStoredTablePreferences('history').load('x')).toBeNull();

    userStore.personal = { id: 'user-1' };
    expect(useStoredTablePreferences('history').load('x')).toEqual([1]);
  });

  test('tolerates a logged-out user and no organization', () => {
    userStore.personal = { isLoggedIn: false };
    userStore.selectedOrganization = null;
    const prefs = useStoredTablePreferences('history');
    prefs.save('x', [1]);
    expect(prefs.load('x')).toEqual([1]);
  });

  test('returns null for corrupt JSON', () => {
    const prefs = useStoredTablePreferences('history');
    prefs.save('x', 1);
    localStorage.setItem(localStorage.key(0)!, '{not json');
    expect(prefs.load('x')).toBeNull();
  });

  test('loadList drops invalid entries and non-arrays', () => {
    const prefs = useStoredTablePreferences('history');
    prefs.save('list', ['A', 'bogus', 'B']);
    expect(prefs.loadList('list', ['A', 'B'])).toEqual(['A', 'B']);

    prefs.save('list', 'A');
    expect(prefs.loadList('list', ['A'])).toEqual([]);
    expect(prefs.loadList('missing', ['A'])).toEqual([]);
  });

  test('loadSort restores a valid stored sort', () => {
    const prefs = useStoredTablePreferences('history');
    prefs.save('sort', { field: 'created_at', direction: 'desc' });
    expect(prefs.loadSort(toSortField, fallback)).toEqual({
      field: 'created_at',
      direction: 'desc',
    });
  });

  test.each([
    ['unknown field', { field: 'nope', direction: 'asc' }],
    ['bad direction', { field: 'created_at', direction: 'sideways' }],
    ['non-string field', { field: 5, direction: 'asc' }],
    ['not an object', 'x'],
  ])('loadSort falls back on %s', (_label, value) => {
    const prefs = useStoredTablePreferences('history');
    prefs.save('sort', value);
    expect(prefs.loadSort(toSortField, fallback)).toEqual(fallback);
  });

  test('loadSort falls back when nothing is stored', () => {
    expect(useStoredTablePreferences('history').loadSort(toSortField, fallback)).toEqual(fallback);
  });
});
