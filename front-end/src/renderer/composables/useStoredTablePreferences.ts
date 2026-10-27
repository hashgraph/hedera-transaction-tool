import useUserStore from '@renderer/stores/storeUser';

/**
 * Persists table preferences (filters, sort) in localStorage, scoped per user,
 * organization and table so they survive leaving the page and relaunching the app.
 */
export default function useStoredTablePreferences(scope: string) {
  const user = useUserStore();

  const storageKey = (name: string) =>
    `${name}:${user.personal && 'id' in user.personal ? user.personal.id : ''}:${
      user.selectedOrganization?.serverUrl ?? ''
    }:${scope}`;

  const load = (name: string): unknown => {
    try {
      return JSON.parse(localStorage.getItem(storageKey(name)) ?? 'null');
    } catch {
      return null;
    }
  };

  const save = (name: string, value: unknown) =>
    localStorage.setItem(storageKey(name), JSON.stringify(value));

  /** Stored list with any entries not in `valid` dropped. */
  const loadList = <T>(name: string, valid: readonly unknown[]): T[] => {
    const stored = load(name);
    return Array.isArray(stored) ? (stored.filter(i => valid.includes(i)) as T[]) : [];
  };

  /** Stored sort, or `fallback` when missing/invalid. */
  const loadSort = <F extends string>(
    isValidField: (field: string) => F | undefined,
    fallback: { field: F; direction: 'asc' | 'desc' },
  ): { field: F; direction: 'asc' | 'desc' } => {
    const stored = load('sort') as { field?: unknown; direction?: unknown } | null;
    const field = typeof stored?.field === 'string' ? isValidField(stored.field) : undefined;
    if (field && (stored?.direction === 'asc' || stored?.direction === 'desc')) {
      return { field, direction: stored.direction };
    }
    return fallback;
  };

  return { load, save, loadList, loadSort };
}
