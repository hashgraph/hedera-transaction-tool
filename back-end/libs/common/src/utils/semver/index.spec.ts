import { checkFrontendVersion, isUpdateAvailable } from './index';

describe('Semver Utilities', () => {
  describe('checkFrontendVersion', () => {
    const repoUrl = 'https://github.com/hashgraph/hedera-transaction-tool/releases/download';

    describe('when user version is older than latest supported', () => {
      it('should indicate update is available', () => {
        const result = checkFrontendVersion('1.0.0', '1.1.0', '0.9.0', repoUrl);

        expect(result.latestSupportedVersion).toBe('1.1.0');
        expect(result.minimumSupportedVersion).toBe('0.9.0');
        expect(result.updateUrl).toBe(`${repoUrl}/v1.1.0/`);
      });

      it('should handle major version differences', () => {
        const result = checkFrontendVersion('1.9.9', '2.0.0', '1.0.0', repoUrl);

        expect(result.updateUrl).not.toBeNull();
        expect(result.updateUrl).toBe(`${repoUrl}/v2.0.0/`);
      });

      it('should handle patch version differences', () => {
        const result = checkFrontendVersion('1.2.3', '1.2.4', '1.0.0', repoUrl);

        expect(result.updateUrl).toBe(`${repoUrl}/v1.2.4/`);
      });
    });

    describe('when user version equals latest supported', () => {
      it('should not indicate update is available', () => {
        const result = checkFrontendVersion('1.2.0', '1.2.0', '1.0.0', repoUrl);

        expect(result.updateUrl).toBeNull();
        expect(result.latestSupportedVersion).toBe('1.2.0');
      });
    });

    describe('when user version is newer than latest supported', () => {
      it('should not indicate update is available', () => {
        const result = checkFrontendVersion('2.0.0', '1.5.0', '1.0.0', repoUrl);

        expect(result.updateUrl).toBeNull();
      });
    });

    describe('when environment variables are not set', () => {
      it('should handle null latest supported version', () => {
        const result = checkFrontendVersion('1.0.0', null, '0.9.0', repoUrl);

        expect(result.latestSupportedVersion).toBe('');
        expect(result.updateUrl).toBeNull();
      });

      it('should handle null minimum supported version', () => {
        const result = checkFrontendVersion('1.0.0', '1.2.0', null, repoUrl);

        expect(result.minimumSupportedVersion).toBe('');
      });

      it('should handle null repo URL', () => {
        const result = checkFrontendVersion('1.0.0', '1.2.0', '0.9.0', null);

        // When repoUrl is null, updateUrl remains null even if update is available
        expect(result.updateUrl).toBeNull();
      });

      it('should handle all null environment values', () => {
        const result = checkFrontendVersion('1.0.0', null, null, null);

        expect(result.latestSupportedVersion).toBe('');
        expect(result.minimumSupportedVersion).toBe('');
        expect(result.updateUrl).toBeNull();
      });
    });

    describe('pre-release versions', () => {
      it('should handle pre-release user versions', () => {
        const result = checkFrontendVersion('1.0.0-beta.1', '1.0.0', '0.9.0', repoUrl);

        expect(result.updateUrl).toBe(`${repoUrl}/v1.0.0/`);
      });

      it('should handle pre-release latest versions', () => {
        const result = checkFrontendVersion('1.0.0', '1.1.0-rc.1', '0.9.0', repoUrl);

        // 1.0.0 is less than 1.1.0-rc.1 in semver
        expect(result.updateUrl).toBe(`${repoUrl}/v1.1.0-rc.1/`);
      });
    });

    describe('URL handling', () => {
      it('should handle trailing slash in repo URL', () => {
        const result = checkFrontendVersion(
          '1.0.0',
          '1.2.0',
          '0.9.0',
          'https://github.com/org/repo/releases/download/',
        );

        expect(result.updateUrl).toBe('https://github.com/org/repo/releases/download/v1.2.0/');
      });

      it('should handle multiple trailing slashes', () => {
        const result = checkFrontendVersion(
          '1.0.0',
          '1.2.0',
          '0.9.0',
          'https://github.com/org/repo/releases/download///',
        );

        expect(result.updateUrl).toBe('https://github.com/org/repo/releases/download/v1.2.0/');
      });
    });

    describe('invalid version handling', () => {
      it('should handle invalid user version gracefully', () => {
        const result = checkFrontendVersion('invalid', '1.2.0', '1.0.0', repoUrl);

        expect(result.updateUrl).toBeNull();
        expect(result.latestSupportedVersion).toBe('1.2.0');
      });

      it('should handle invalid latest version gracefully', () => {
        const result = checkFrontendVersion('1.0.0', 'invalid', '0.9.0', repoUrl);

        expect(result.updateUrl).toBeNull();
        expect(result.latestSupportedVersion).toBe('invalid');
      });
    });
  });

  describe('isUpdateAvailable', () => {
    it('should return true when client version is older than latest', () => {
      expect(isUpdateAvailable('1.0.0', '1.1.0')).toBe(true);
    });

    it('should return true for major version differences', () => {
      expect(isUpdateAvailable('1.9.9', '2.0.0')).toBe(true);
    });

    it('should return true for patch version differences', () => {
      expect(isUpdateAvailable('1.2.3', '1.2.4')).toBe(true);
    });

    it('should return false when client version equals latest', () => {
      expect(isUpdateAvailable('1.2.0', '1.2.0')).toBe(false);
    });

    it('should return false when client version is newer than latest', () => {
      expect(isUpdateAvailable('2.0.0', '1.5.0')).toBe(false);
    });

    it('should return false when latestSupported is null', () => {
      expect(isUpdateAvailable('1.0.0', null)).toBe(false);
    });

    it('should return false when latestSupported is undefined', () => {
      expect(isUpdateAvailable('1.0.0', undefined)).toBe(false);
    });

    it('should return false when client version is invalid', () => {
      expect(isUpdateAvailable('invalid', '1.2.0')).toBe(false);
    });

    it('should return false when latest version is invalid', () => {
      expect(isUpdateAvailable('1.0.0', 'invalid')).toBe(false);
    });

    it('should handle pre-release client versions', () => {
      expect(isUpdateAvailable('1.0.0-beta.1', '1.0.0')).toBe(true);
    });

    it('should handle pre-release latest versions', () => {
      expect(isUpdateAvailable('1.0.0', '1.1.0-rc.1')).toBe(true);
    });
  });
});

