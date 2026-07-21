import { ref } from 'vue';

import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.composable.versionCheck');

import { SESSION_STORAGE_DISMISSED_UPDATE_PROMPT } from '@shared/constants';

import { checkVersion } from '@renderer/services/organization';
import { FRONTEND_VERSION } from '@renderer/utils/version';

import {
  versionStatus,
  updateUrl,
  latestVersion,
  resetVersionState,
  setVersionDataForOrg,
  initialVersionCheckState,
  type VersionStatus,
} from '@renderer/stores/versionState';
import type { Organization } from '@prisma/client';

const isDismissed = ref(
  typeof sessionStorage !== 'undefined'
    ? sessionStorage.getItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT) === 'true'
    : false,
);

// per org checking flags
const orgChecks = ref<Record<string, boolean>>({});

export default function useVersionCheck() {
  const performVersionCheck = async (organization: Organization): Promise<void> => {
    if (orgChecks.value[organization.serverUrl]) {
      return;
    }

    try {
      orgChecks.value[organization.serverUrl] = true;

      const response = await checkVersion(organization, FRONTEND_VERSION);

      setVersionDataForOrg(organization.serverUrl, {
        latestSupportedVersion: response.latestSupportedVersion,
        minimumSupportedVersion: response.minimumSupportedVersion,
        updateUrl: response.updateUrl,
      });
    } catch (error) {
      // Failed checks leave the per-org status undefined. The global
      // versionStatus computed treats "no entries" as null, which the
      // modals already gate on — no UI difference vs. the prior "force
      // current" fallback. A prior belowMinimum (from a forced override
      // or earlier successful check) is preserved automatically.
      logger.error('Version check failed', { error });
    } finally {
      orgChecks.value[organization.serverUrl] = false;
    }
  };

  // Runs the per-org check across every supplied serverUrl, then flips
  // initialVersionCheckState to 'done' so the upgrade modals (which gate
  // on 'done') start rendering. Single entry point for both auto-login
  // and manual-login startup paths. Concurrent re-entry is dropped: the
  // 'running' state bars a second batch from racing the first into 'done'.
  const performInitialVersionCheck = async (organizations: Organization[]): Promise<void> => {
    if (initialVersionCheckState.value !== 'idle') return;

    initialVersionCheckState.value = 'running';
    try {
      await Promise.allSettled(organizations.map(org => performVersionCheck(org)));
    } finally {
      initialVersionCheckState.value = 'done';
    }
  };

  const dismissOptionalUpdate = (): void => {
    sessionStorage.setItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT, 'true');
    isDismissed.value = true;
  };

  const reset = (): void => {
    resetVersionState();
    isDismissed.value = false;
    orgChecks.value = {}; // clear flags on reset
    sessionStorage.removeItem(SESSION_STORAGE_DISMISSED_UPDATE_PROMPT);
  };

  return {
    versionStatus,
    updateUrl,
    latestVersion,
    performVersionCheck,
    performInitialVersionCheck,
    isDismissed,
    orgChecks,
    dismissOptionalUpdate,
    reset,
  };
}

export type { VersionStatus };
