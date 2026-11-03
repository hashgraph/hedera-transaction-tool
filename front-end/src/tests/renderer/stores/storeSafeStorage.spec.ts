import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import useSafeStorage, { SafeStorageStatus } from '@renderer/stores/storeSafeStorage';
import { checkKeychain } from '@renderer/services/safeStorageService';

vi.mock('@renderer/services/safeStorageService', () => ({ checkKeychain: vi.fn() }));

describe('storeSafeStorage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
  });

  test('starts available', () => {
    expect(useSafeStorage().keychainUnavailable).toBe(false);
  });

  test('checkKeychain marks the store authorized when the keychain is usable', async () => {
    vi.mocked(checkKeychain).mockResolvedValue(true);
    const store = useSafeStorage();

    expect(await store.checkKeychain()).toBe(true);
    expect(store.status).toBe(SafeStorageStatus.authorized);
  });

  test('checkKeychain marks the store denied when the keychain is not usable', async () => {
    vi.mocked(checkKeychain).mockResolvedValue(false);
    const store = useSafeStorage();

    expect(await store.checkKeychain()).toBe(false);
    expect(store.status).toBe(SafeStorageStatus.denied);
  });

  test('checkKeychain leaves the status untouched when the check itself fails', async () => {
    vi.mocked(checkKeychain).mockRejectedValue(new Error('ipc down'));
    const store = useSafeStorage();

    await expect(store.checkKeychain()).rejects.toThrow('ipc down');
    expect(store.status).toBe(SafeStorageStatus.notDetermined);
  });
});
