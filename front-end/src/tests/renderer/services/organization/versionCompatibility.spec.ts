// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@renderer/utils/version', () => ({
  FRONTEND_VERSION: '1.0.0',
}));

describe('versionCompatibility', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('checkCompatibilityAcrossOrganizations', () => {
    test('returns no conflicts when no other orgs exist', async () => {
      const { checkCompatibilityAcrossOrganizations } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      const result = checkCompatibilityAcrossOrganizations(
        'https://triggering',
        {
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '1.0.0',
          updateUrl: 'https://download/v2',
        },
        [],
        {},
      );
      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toEqual([]);
      expect(result.suggestedVersion).toBe('2.0.0');
    });

    test('skips orgs with no known version (instead of treating as conflict)', async () => {
      const { checkCompatibilityAcrossOrganizations } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      const result = checkCompatibilityAcrossOrganizations(
        'https://triggering',
        {
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '1.0.0',
          updateUrl: 'https://download/v2',
        },
        [{ serverUrl: 'https://no-data', nickname: 'No Data' }],
        {},
      );
      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toEqual([]);
    });

    test('reports conflict when triggering minimum is above another org latest', async () => {
      const { checkCompatibilityAcrossOrganizations } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      const result = checkCompatibilityAcrossOrganizations(
        'https://triggering',
        {
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '1.5.0',
          updateUrl: 'https://download/v2',
        },
        [{ serverUrl: 'https://low', nickname: 'Low' }],
        { 'https://low': '1.0.0' },
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        serverUrl: 'https://low',
        organizationName: 'Low',
        latestSupportedVersion: '1.0.0',
        suggestedVersion: '2.0.0',
      });
    });

    test('does not flag conflict when other org latest is at triggering minimum', async () => {
      const { checkCompatibilityAcrossOrganizations } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      const result = checkCompatibilityAcrossOrganizations(
        'https://triggering',
        {
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '1.0.0',
          updateUrl: 'https://download/v2',
        },
        [{ serverUrl: 'https://equal' }],
        { 'https://equal': '1.0.0' },
      );
      expect(result.hasConflict).toBe(false);
    });

    test('excludes the triggering org from the comparison', async () => {
      const { checkCompatibilityAcrossOrganizations } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      const result = checkCompatibilityAcrossOrganizations(
        'https://triggering',
        {
          latestSupportedVersion: '2.5.0',
          minimumSupportedVersion: '1.5.0',
          updateUrl: 'https://download/v2.5',
        },
        [{ serverUrl: 'https://triggering' }, { serverUrl: 'https://other' }],
        {
          'https://triggering': '2.0.0',
          'https://other': '1.0.0',
        },
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts.map(c => c.serverUrl)).toEqual(['https://other']);
    });

    test('returns no conflicts when triggering latest version is unparseable', async () => {
      const { checkCompatibilityAcrossOrganizations } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      const result = checkCompatibilityAcrossOrganizations(
        'https://triggering',
        {
          latestSupportedVersion: 'not-a-version',
          minimumSupportedVersion: '1.0.0',
          updateUrl: null,
        },
        [{ serverUrl: 'https://a' }],
        { 'https://a': '1.0.0' },
      );
      expect(result.hasConflict).toBe(false);
      expect(result.suggestedVersion).toBeNull();
    });

    test('regression: no conflict when other latest equals triggering minimum even if below triggering latest', async () => {
      const { checkCompatibilityAcrossOrganizations } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      const result = checkCompatibilityAcrossOrganizations(
        'https://triggering',
        {
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '1.0.0',
          updateUrl: 'https://download/v2',
        },
        [{ serverUrl: 'https://other', nickname: 'Other' }],
        { 'https://other': '1.0.0' },
      );

      expect(result.hasConflict).toBe(false);
      expect(result.suggestedVersion).toBe('2.0.0');
    });

    test('regression: conflict when triggering minimum is above other latest', async () => {
      const { checkCompatibilityAcrossOrganizations } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      const result = checkCompatibilityAcrossOrganizations(
        'https://triggering',
        {
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '1.5.0',
          updateUrl: 'https://download/v2',
        },
        [{ serverUrl: 'https://other', nickname: 'Other' }],
        { 'https://other': '1.0.0' },
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts[0]).toEqual({
        serverUrl: 'https://other',
        organizationName: 'Other',
        latestSupportedVersion: '1.0.0',
        suggestedVersion: '2.0.0',
      });
    });
  });

  describe('isVersionBelowMinimum', () => {
    test('returns false when no minimum specified', async () => {
      const { isVersionBelowMinimum } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      expect(
        isVersionBelowMinimum({
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '',
          updateUrl: null,
        }),
      ).toBe(false);
    });

    test('returns false when current >= minimum', async () => {
      const { isVersionBelowMinimum } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      // FRONTEND_VERSION mock is '1.0.0'
      expect(
        isVersionBelowMinimum({
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '1.0.0',
          updateUrl: null,
        }),
      ).toBe(false);
      expect(
        isVersionBelowMinimum({
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '0.9.0',
          updateUrl: null,
        }),
      ).toBe(false);
    });

    test('returns true when current < minimum', async () => {
      const { isVersionBelowMinimum } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      expect(
        isVersionBelowMinimum({
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: '1.0.1',
          updateUrl: null,
        }),
      ).toBe(true);
    });

    test('returns false for unparseable version strings', async () => {
      const { isVersionBelowMinimum } = await import(
        '@renderer/services/organization/versionCompatibility'
      );
      expect(
        isVersionBelowMinimum({
          latestSupportedVersion: '2.0.0',
          minimumSupportedVersion: 'garbage',
          updateUrl: null,
        }),
      ).toBe(false);
    });
  });
});
