import { vi } from 'vitest';

const storage = new Map<string, string>();

vi.stubGlobal(
  'sessionStorage',
  Object.freeze({
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() {
      return storage.size;
    },
    key: (index: number) => [...storage.keys()][index] ?? null,
  }),
);
