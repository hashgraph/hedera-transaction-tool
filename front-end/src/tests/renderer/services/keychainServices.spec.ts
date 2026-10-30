// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { relaunch } from '@renderer/services/electronUtilsService';
import { checkKeychain } from '@renderer/services/safeStorageService';

const mocks = vi.hoisted(() => ({ relaunch: vi.fn(), checkKeychain: vi.fn() }));

describe('keychain-related IPC service wrappers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.electronAPI = {
      local: {
        utils: { relaunch: mocks.relaunch },
        safeStorage: { checkKeychain: mocks.checkKeychain },
      },
    } as never;
  });

  test('checkKeychain returns the main-process verdict', async () => {
    mocks.checkKeychain.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    expect(await checkKeychain()).toBe(true);
    expect(await checkKeychain()).toBe(false);
  });

  test('checkKeychain surfaces IPC failures instead of reporting a verdict', async () => {
    mocks.checkKeychain.mockRejectedValue(new Error('ipc down'));

    await expect(checkKeychain()).rejects.toThrow();
  });

  test('relaunch asks the main process to relaunch', async () => {
    mocks.relaunch.mockResolvedValue(undefined);

    await relaunch();

    expect(mocks.relaunch).toHaveBeenCalledOnce();
  });
});
