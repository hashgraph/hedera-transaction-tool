// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { LOCAL_STORAGE_ORG_VERSION_DATA } from '@shared/constants';

// `versionState` reads localStorage at module init. Tests that need to test
// rehydration seed localStorage first, then dynamic-import the module after
// `vi.resetModules()`. Tests that don't care about rehydration can just
// import normally and use the public setters.

// The compat computed gates on getActivePinia() before calling useUserStore,
// so an active Pinia must be installed for it to read the mocked store.
const mockOrgs: Array<{ serverUrl: string; nickname?: string }> = [];

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({ organizations: mockOrgs }),
}));

vi.mock('@renderer/utils/version', () => ({
  FRONTEND_VERSION: '1.0.0',
}));

describe('versionState', () => {
  beforeEach(() => {
    localStorage.clear();
    mockOrgs.length = 0;
    setActivePinia(createPinia());
    vi.resetModules();
  });

  test('setVersionDataForOrg populates every per-org ref', async () => {
    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://org-a', {
      latestSupportedVersion: '0.30.0',
      minimumSupportedVersion: '0.29.0',
      updateUrl: 'https://example.com/download/v0.30.0',
    });

    expect(mod.organizationVersionData.value['https://org-a']).toEqual({
      latestSupportedVersion: '0.30.0',
      minimumSupportedVersion: '0.29.0',
      updateUrl: 'https://example.com/download/v0.30.0',
    });
    expect(mod.organizationLatestVersions.value['https://org-a']).toBe('0.30.0');
    expect(mod.organizationMinimumVersions.value['https://org-a']).toBe('0.29.0');
    expect(mod.organizationUpdateUrls.value['https://org-a']).toBe(
      'https://example.com/download/v0.30.0',
    );
    expect(mod.organizationUpdateTimestamps.value['https://org-a']).toBeInstanceOf(Date);
  });

  test('setVersionDataForOrg persists the full map to localStorage', async () => {
    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '0.30.0',
      minimumSupportedVersion: '0.29.0',
      updateUrl: null,
    });
    mod.setVersionDataForOrg('https://b', {
      latestSupportedVersion: '0.31.0',
      minimumSupportedVersion: '0.30.0',
      updateUrl: 'https://download',
    });

    const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ORG_VERSION_DATA) ?? '{}');
    expect(stored['https://a'].latestSupportedVersion).toBe('0.30.0');
    expect(stored['https://b'].updateUrl).toBe('https://download');
  });

  test('rehydrates per-org refs from localStorage on import', async () => {
    localStorage.setItem(
      LOCAL_STORAGE_ORG_VERSION_DATA,
      JSON.stringify({
        'https://org-a': {
          latestSupportedVersion: '0.30.0',
          minimumSupportedVersion: '0.29.0',
          updateUrl: null,
        },
      }),
    );

    const mod = await import('@renderer/stores/versionState');
    expect(mod.organizationLatestVersions.value['https://org-a']).toBe('0.30.0');
    expect(mod.organizationMinimumVersions.value['https://org-a']).toBe('0.29.0');
    expect(mod.organizationUpdateUrls.value['https://org-a']).toBeNull();
    expect(mod.organizationVersionData.value['https://org-a']).toEqual({
      latestSupportedVersion: '0.30.0',
      minimumSupportedVersion: '0.29.0',
      updateUrl: null,
    });
  });

  test('ignores malformed localStorage payload without throwing', async () => {
    localStorage.setItem(LOCAL_STORAGE_ORG_VERSION_DATA, 'not-json{');
    const mod = await import('@renderer/stores/versionState');
    expect(mod.organizationLatestVersions.value).toEqual({});
    expect(mod.organizationVersionData.value).toEqual({});
  });

  test('resetVersionStatusForOrg removes only that org from refs and storage', async () => {
    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '0.30.0',
      minimumSupportedVersion: '0.29.0',
      updateUrl: null,
    });
    mod.setVersionDataForOrg('https://b', {
      latestSupportedVersion: '0.31.0',
      minimumSupportedVersion: '0.30.0',
      updateUrl: null,
    });

    mod.resetVersionStatusForOrg('https://a');

    expect(mod.organizationLatestVersions.value['https://a']).toBeUndefined();
    expect(mod.organizationLatestVersions.value['https://b']).toBe('0.31.0');
    const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_ORG_VERSION_DATA) ?? '{}');
    expect(stored).not.toHaveProperty('https://a');
    expect(stored).toHaveProperty('https://b');
  });

  test('resetVersionStatusForOrg removes the org entry from derived status', async () => {
    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '1.5.0',
      updateUrl: 'https://download',
    });
    expect(mod.organizationVersionStatus.value['https://a']).toBe('belowMinimum');

    mod.resetVersionStatusForOrg('https://a');
    expect(mod.organizationVersionStatus.value['https://a']).toBeUndefined();
  });

  test('resetVersionState wipes volatile state but rehydrates persistent cache', async () => {
    const mod = await import('@renderer/stores/versionState');

    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '0.30.0',
      minimumSupportedVersion: '0.29.0',
      updateUrl: null,
    });
    mod.initialVersionCheckState.value = 'done';

    mod.resetVersionState();

    expect(mod.organizationUpdateTimestamps.value).toEqual({});
    expect(mod.initialVersionCheckState.value).toBe('idle');

    // Cache rehydrated from disk:
    expect(mod.organizationLatestVersions.value['https://a']).toBe('0.30.0');
    expect(mod.organizationMinimumVersions.value['https://a']).toBe('0.29.0');
    expect(mod.organizationVersionData.value['https://a']).toEqual({
      latestSupportedVersion: '0.30.0',
      minimumSupportedVersion: '0.29.0',
      updateUrl: null,
    });
  });

  test('status derives to current when data has no updateUrl and current >= minimum', async () => {
    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '1.0.0',
      minimumSupportedVersion: '0.9.0',
      updateUrl: null,
    });
    expect(mod.organizationVersionStatus.value['https://a']).toBe('current');
  });

  test('status derives to updateAvailable when updateUrl is present and current >= minimum', async () => {
    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '0.9.0',
      updateUrl: 'https://download/v2',
    });
    expect(mod.organizationVersionStatus.value['https://a']).toBe('updateAvailable');
  });

  test('status derives to belowMinimum when current < minimum', async () => {
    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '1.5.0',
      updateUrl: 'https://download/v2',
    });
    expect(mod.organizationVersionStatus.value['https://a']).toBe('belowMinimum');
  });

  test('versionStatus prioritizes belowMinimum > updateAvailable > current', async () => {
    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '1.0.0',
      minimumSupportedVersion: '0.9.0',
      updateUrl: null,
    });
    expect(mod.versionStatus.value).toBe('current');

    mod.setVersionDataForOrg('https://b', {
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '0.9.0',
      updateUrl: 'https://download',
    });
    expect(mod.versionStatus.value).toBe('updateAvailable');

    mod.setVersionDataForOrg('https://c', {
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '1.5.0',
      updateUrl: 'https://download',
    });
    expect(mod.versionStatus.value).toBe('belowMinimum');
  });

  test('versionStatus returns null when no statuses recorded', async () => {
    const mod = await import('@renderer/stores/versionState');
    expect(mod.versionStatus.value).toBeNull();
  });

  test('triggeringOrganizationServerUrl picks the most recently updated org needing update', async () => {
    const mod = await import('@renderer/stores/versionState');

    // Advance the fake clock between writes so the timestamps used by
    // getOrgsNeedingUpdateOrdered are strictly ordered. Using a real
    // setTimeout would be flaky on fast machines (timestamps can collide
    // within a single millisecond).
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      mod.setVersionDataForOrg('https://a', {
        latestSupportedVersion: '2.0.0',
        minimumSupportedVersion: '0.9.0',
        updateUrl: 'https://download/a',
      });
      vi.setSystemTime(new Date('2024-01-01T00:00:05Z'));
      mod.setVersionDataForOrg('https://b', {
        latestSupportedVersion: '2.0.0',
        minimumSupportedVersion: '1.5.0',
        updateUrl: 'https://download/b',
      });
      expect(mod.triggeringOrganizationServerUrl.value).toBe('https://b');
    } finally {
      vi.useRealTimers();
    }
  });

  test('triggeringOrganizationServerUrl is null when nothing needs an update', async () => {
    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '1.0.0',
      minimumSupportedVersion: '0.9.0',
      updateUrl: null,
    });
    expect(mod.triggeringOrganizationServerUrl.value).toBeNull();
  });

  test('organizationVersionData exposes cached entries by serverUrl', async () => {
    const mod = await import('@renderer/stores/versionState');
    expect(mod.organizationVersionData.value['https://missing']).toBeUndefined();

    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '0.30.0',
      minimumSupportedVersion: '0.29.0',
      updateUrl: null,
    });
    expect(mod.organizationVersionData.value['https://a']).toEqual({
      latestSupportedVersion: '0.30.0',
      minimumSupportedVersion: '0.29.0',
      updateUrl: null,
    });
  });

  test('getAllOrganizationVersions returns only non-null entries', async () => {
    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://a', {
      latestSupportedVersion: '0.30.0',
      minimumSupportedVersion: '0.29.0',
      updateUrl: null,
    });
    mod.organizationVersionData.value['https://b'] = null;

    expect(Object.keys(mod.getAllOrganizationVersions())).toEqual(['https://a']);
  });

  test('organizationCompatibilityResults compares triggering minimum against other latest while preserving suggested latest', async () => {
    mockOrgs.push({ serverUrl: 'https://leader', nickname: 'Leader' });
    mockOrgs.push({ serverUrl: 'https://laggard', nickname: 'Laggard' });

    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://leader', {
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '1.5.0',
      updateUrl: 'https://download/v2',
    });
    mod.setVersionDataForOrg('https://laggard', {
      latestSupportedVersion: '1.0.0',
      minimumSupportedVersion: '0.9.0',
      updateUrl: null,
    });

    const leaderResult = mod.organizationCompatibilityResults.value['https://leader'];
    expect(leaderResult?.hasConflict).toBe(true);
    expect(leaderResult?.suggestedVersion).toBe('2.0.0');
    expect(leaderResult?.conflicts.map(c => c.serverUrl)).toEqual(['https://laggard']);
  });

  test('organizationCompatibilityResults does not conflict when other latest equals triggering minimum', async () => {
    mockOrgs.push({ serverUrl: 'https://leader', nickname: 'Leader' });
    mockOrgs.push({ serverUrl: 'https://peer', nickname: 'Peer' });

    const mod = await import('@renderer/stores/versionState');
    mod.setVersionDataForOrg('https://leader', {
      latestSupportedVersion: '2.0.0',
      minimumSupportedVersion: '1.0.0',
      updateUrl: 'https://download/v2',
    });
    mod.setVersionDataForOrg('https://peer', {
      latestSupportedVersion: '1.0.0',
      minimumSupportedVersion: '0.9.0',
      updateUrl: null,
    });

    const leaderResult = mod.organizationCompatibilityResults.value['https://leader'];
    expect(leaderResult?.hasConflict).toBe(false);
    expect(leaderResult?.conflicts).toEqual([]);
    expect(leaderResult?.suggestedVersion).toBe('2.0.0');
  });

  test('initialVersionCheckState starts idle', async () => {
    const mod = await import('@renderer/stores/versionState');
    expect(mod.initialVersionCheckState.value).toBe('idle');
  });
});
