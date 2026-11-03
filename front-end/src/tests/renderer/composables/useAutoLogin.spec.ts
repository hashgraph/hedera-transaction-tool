// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import useAutoLogin from '@renderer/composables/useAutoLogin';
import useSafeStorage from '@renderer/stores/storeSafeStorage';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  getUseKeychain: vi.fn(),
  getStaticUser: vi.fn(),
  checkKeychain: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({ login: mocks.login, logout: mocks.logout })),
}));

vi.mock('@renderer/services/safeStorageService', () => ({
  getUseKeychain: mocks.getUseKeychain,
  getStaticUser: mocks.getStaticUser,
  checkKeychain: mocks.checkKeychain,
}));

const setup = () => {
  let run!: () => Promise<void>;
  mount(
    defineComponent({
      setup() {
        run = useAutoLogin();
        return () => null;
      },
    }),
  );
  return run;
};

describe('useAutoLogin keychain gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    localStorage.clear();
    mocks.getUseKeychain.mockResolvedValue(true);
    mocks.getStaticUser.mockResolvedValue({ id: 'static', email: 'keychain@mode' });
  });

  test('logs in and leaves the flag clear when the keychain works', async () => {
    mocks.checkKeychain.mockResolvedValue(true);

    await setup()();

    expect(mocks.login).toHaveBeenCalledWith('static', 'keychain@mode', true);
    expect(useSafeStorage().keychainUnavailable).toBe(false);
  });

  test('does not log in and sets the flag when the keychain is unavailable', async () => {
    mocks.checkKeychain.mockResolvedValue(false);

    await setup()();

    expect(mocks.login).not.toHaveBeenCalled();
    expect(useSafeStorage().keychainUnavailable).toBe(true);
  });

  test('treats a failed keychain probe as unavailable', async () => {
    mocks.checkKeychain.mockRejectedValue(new Error('ipc failed'));

    await setup()();

    expect(mocks.login).not.toHaveBeenCalled();
    expect(useSafeStorage().keychainUnavailable).toBe(true);
  });

  test('does not probe the keychain outside keychain mode', async () => {
    mocks.getUseKeychain.mockResolvedValue(false);

    await setup()();

    expect(mocks.checkKeychain).not.toHaveBeenCalled();
    expect(useSafeStorage().keychainUnavailable).toBe(false);
  });
});
