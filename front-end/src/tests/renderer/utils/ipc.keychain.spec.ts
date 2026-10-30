import { beforeEach, describe, expect, test } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { KEYCHAIN_UNAVAILABLE_MESSAGE } from '@shared/constants';

import useSafeStorage from '@renderer/stores/storeSafeStorage';

import { commonIPCHandler, getMessageFromIPCError } from '@renderer/utils/ipc';

const keychainIPCError = () =>
  new Error(
    `Error invoking remote method 'organizationCredentials:tryAutoSignIn': Error: ${KEYCHAIN_UNAVAILABLE_MESSAGE}`,
  );

describe('ipc keychain errors', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('getMessageFromIPCError keeps the keychain message from an Electron-formatted error', () => {
    expect(getMessageFromIPCError(keychainIPCError(), 'default')).toBe(KEYCHAIN_UNAVAILABLE_MESSAGE);
  });

  test('commonIPCHandler flags the keychain as unavailable and rethrows the message', async () => {
    await expect(
      commonIPCHandler(async () => {
        throw keychainIPCError();
      }, 'default'),
    ).rejects.toThrow(KEYCHAIN_UNAVAILABLE_MESSAGE);

    expect(useSafeStorage().keychainUnavailable).toBe(true);
  });

  test('commonIPCHandler leaves the flag alone for other errors', async () => {
    await expect(
      commonIPCHandler(async () => {
        throw new Error("Error invoking remote method 'x': Error: boom");
      }, 'default'),
    ).rejects.toThrow('boom');

    expect(useSafeStorage().keychainUnavailable).toBe(false);
  });

  test('commonIPCHandler does not need an active pinia for non-keychain errors', async () => {
    setActivePinia(undefined);

    await expect(
      commonIPCHandler(async () => {
        throw new Error('plain');
      }, 'default'),
    ).rejects.toThrow('default');
  });
});
