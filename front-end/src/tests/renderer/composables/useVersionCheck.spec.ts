// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { SESSION_STORAGE_DISMISSED_UPDATE_PROMPT } from '@shared/constants';

// We mock the network call so the composable's orchestration is what's under
// test, not the side effects of the version-check HTTP layer. The store
// itself is real — the refactor made status derivation purely state-driven,
// so asserting on `organizationVersionStatus` exercises the real pipeline.
const checkVersionMock = vi.fn();

const mockOrgs: Array<{ serverUrl: string; nickname?: string }> = [];

vi.mock('@renderer/services/organization', () => ({
  checkVersion: (...args: unknown[]) => checkVersionMock(...args),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({ organizations: mockOrgs }),
}));

vi.mock('@renderer/utils/version', () => ({
  FRONTEND_VERSION: '1.0.0',
}));

describe('useVersionCheck', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockOrgs.length = 0;
    checkVersionMock.mockReset();
    vi.resetModules();
  });

  test('performVersionCheck stores fresh data so the derived status reflects it', async () => {
    const useVersionCheck = (await import('@renderer/composables/useVersionCheck')).default;
    const state = await import('@renderer/stores/versionState');
    const response = {
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '1.0.0',
      updateUrl: 'https://download/v2',
    };
    checkVersionMock.mockResolvedValueOnce(response);

    const { performVersionCheck } = useVersionCheck();
    await performVersionCheck('https://a');

    expect(checkVersionMock).toHaveBeenCalledWith('https://a', '1.0.0');
    expect(state.organizationVersionData.value['https://a']).toEqual(response);
    expect(state.organizationVersionStatus.value['https://a']).toBe('updateAvailable');
  });

  test('performVersionCheck leaves status unset on error so the global aggregator stays null', async () => {
    const useVersionCheck = (await import('@renderer/composables/useVersionCheck')).default;
    const state = await import('@renderer/stores/versionState');
    checkVersionMock.mockRejectedValueOnce(new Error('network down'));

    const { performVersionCheck } = useVersionCheck();
    await performVersionCheck('https://offline');

    expect(state.organizationVersionStatus.value['https://offline']).toBeUndefined();
    expect(state.organizationVersionData.value['https://offline']).toBeUndefined();
  });

  test('performVersionCheck dedupes concurrent calls for the same org', async () => {
    const useVersionCheck = (await import('@renderer/composables/useVersionCheck')).default;
    let resolve!: (value: unknown) => void;
    checkVersionMock.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r;
        }),
    );

    const { performVersionCheck } = useVersionCheck();
    const first = performVersionCheck('https://a');
    const second = performVersionCheck('https://a');

    resolve({
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '1.0.0',
      updateUrl: null,
    });
    await Promise.all([first, second]);

    expect(checkVersionMock).toHaveBeenCalledTimes(1);
  });

  test('performInitialVersionCheck stays in running state until the batch settles, then moves to done', async () => {
    const useVersionCheck = (await import('@renderer/composables/useVersionCheck')).default;
    const state = await import('@renderer/stores/versionState');

    let resolveA!: () => void;
    let resolveB!: () => void;
    checkVersionMock.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolveA = () => r({
            latestSupportedVersion: '1.0.0',
            minimumSupportedVersion: '1.0.0',
            updateUrl: null,
          });
        }),
    );
    checkVersionMock.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolveB = () => r({
            latestSupportedVersion: '1.0.0',
            minimumSupportedVersion: '1.0.0',
            updateUrl: null,
          });
        }),
    );

    const { performInitialVersionCheck } = useVersionCheck();
    const promise = performInitialVersionCheck(['https://a', 'https://b']);
    // Still running while the batch is in flight — modals must stay hidden.
    expect(state.initialVersionCheckState.value).toBe('running');

    resolveA();
    resolveB();
    await promise;
    expect(state.initialVersionCheckState.value).toBe('done');
  });

  test('performInitialVersionCheck still resolves and reaches done if a check rejects', async () => {
    const useVersionCheck = (await import('@renderer/composables/useVersionCheck')).default;
    const state = await import('@renderer/stores/versionState');

    checkVersionMock.mockResolvedValueOnce({
      latestSupportedVersion: '1.0.0',
      minimumSupportedVersion: '1.0.0',
      updateUrl: null,
    });
    checkVersionMock.mockRejectedValueOnce(new Error('boom'));

    const { performInitialVersionCheck } = useVersionCheck();
    await performInitialVersionCheck(['https://a', 'https://b']);

    expect(state.initialVersionCheckState.value).toBe('done');
    // First org went through; second got no entry because it failed.
    expect(state.organizationVersionData.value['https://a']).toBeDefined();
    expect(state.organizationVersionData.value['https://b']).toBeUndefined();
  });

  test('a second performInitialVersionCheck while one is running is a no-op and does not race the flag', async () => {
    const useVersionCheck = (await import('@renderer/composables/useVersionCheck')).default;
    const state = await import('@renderer/stores/versionState');

    // First batch's HTTP call hangs until we resolve it.
    let resolveA!: () => void;
    checkVersionMock.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolveA = () => r({
            latestSupportedVersion: '1.0.0',
            minimumSupportedVersion: '1.0.0',
            updateUrl: null,
          });
        }),
    );

    const { performInitialVersionCheck } = useVersionCheck();
    const first = performInitialVersionCheck(['https://a']);
    expect(state.initialVersionCheckState.value).toBe('running');

    // Second call while the first is still in flight — must bail without
    // flipping the state to 'done' or invoking checkVersion again.
    await performInitialVersionCheck(['https://a']);
    expect(state.initialVersionCheckState.value).toBe('running');
    expect(checkVersionMock).toHaveBeenCalledTimes(1);

    resolveA();
    await first;
    expect(state.initialVersionCheckState.value).toBe('done');
  });

  test('performInitialVersionCheck is a no-op once already done', async () => {
    const useVersionCheck = (await import('@renderer/composables/useVersionCheck')).default;
    const state = await import('@renderer/stores/versionState');

    state.initialVersionCheckState.value = 'done';

    const { performInitialVersionCheck } = useVersionCheck();
    await performInitialVersionCheck(['https://a', 'https://b']);

    expect(checkVersionMock).not.toHaveBeenCalled();
  });

  test('dismissOptionalUpdate writes to sessionStorage and flips isDismissed', async () => {
    const useVersionCheck = (await import('@renderer/composables/useVersionCheck')).default;
    const { dismissOptionalUpdate, isDismissed } = useVersionCheck();

    dismissOptionalUpdate();
    expect(isDismissed.value).toBe(true);
    expect(sessionStorage.getItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT)).toBe('true');
  });

  test('reset clears session dismissal and volatile state', async () => {
    const useVersionCheck = (await import('@renderer/composables/useVersionCheck')).default;
    const state = await import('@renderer/stores/versionState');
    sessionStorage.setItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT, 'true');
    state.initialVersionCheckState.value = 'done';

    const { reset, isDismissed } = useVersionCheck();
    reset();

    expect(isDismissed.value).toBe(false);
    expect(state.initialVersionCheckState.value).toBe('idle');
    expect(sessionStorage.getItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT)).toBeNull();
  });
});
