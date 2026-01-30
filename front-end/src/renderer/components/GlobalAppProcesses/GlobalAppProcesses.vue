<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { ACCOUNT_SETUP_STARTED } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import useAutoLogin from '@renderer/composables/useAutoLogin';
import useLoader from '@renderer/composables/useLoader';
import useSetupStores from '@renderer/composables/user/useSetupStores';
import useRecoveryPhraseHashMigrate from '@renderer/composables/useRecoveryPhraseHashMigrate';
import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';
import useVersionCheck from '@renderer/composables/useVersionCheck';
import useAppVisibility from '@renderer/composables/useAppVisibility';

import { getUseKeychain } from '@renderer/services/safeStorageService';
import { getUsersCount, resetDataLocal } from '@renderer/services/userService';
import { getStoredClaim } from '@renderer/services/claimService';
import { checkCompatibilityAcrossOrganizations } from '@renderer/services/organization/versionCompatibility';
import {
  getVersionStatusForOrg,
  organizationCompatibilityResults,
} from '@renderer/stores/versionState';

import AutoLoginInOrganization from '@renderer/components/Organization/AutoLoginInOrganization.vue';
import ImportantNote from './components/ImportantNote.vue';
import BeginDataMigration from './components/BeginDataMigration.vue';
import MandatoryUpgrade from './components/MandatoryUpgrade.vue';
import OptionalUpgrade from './components/OptionalUpgrade.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const withLoader = useLoader();
const tryAutoLogin = useAutoLogin();
const setupStores = useSetupStores();
const { select: selectDefaultOrganization } = useDefaultOrganization();
const { redirectIfRequiredKeysToMigrate } = useRecoveryPhraseHashMigrate();
const { performVersionCheck, getAllOrganizationVersionData } = useVersionCheck();

/* State */
const importantNoteRef = ref<InstanceType<typeof ImportantNote> | null>(null);
const beginDataMigrationRef = ref<InstanceType<typeof BeginDataMigration> | null>(null);
const autoLoginRef = ref<InstanceType<typeof AutoLoginInOrganization> | null>(null);

const precheckReady = ref(false);
const importantNoteReady = ref(false);
const migrate = ref(false);

/* App Visibility - handles token refresh when app regains focus */
const handleTokenExpired = async () => {
  if (autoLoginRef.value) {
    await autoLoginRef.value.triggerReauthentication();
  }
};

useAppVisibility({
  debounceMs: 2000,
  onTokenExpired: handleTokenExpired,
});

/* Handlers */
const handleImportantModalReady = async () => {
  importantNoteReady.value = true;
  await beginDataMigrationRef.value?.initialize();
};

const handleBeginMigrationReadyState = async () => {
  await withLoader(tryAutoLogin);

  await user.refetchOrganizations();
  const redirect = await redirectIfRequiredKeysToMigrate();
  if (!redirect) {
    await withLoader(selectDefaultOrganization);
  }

  await setupStores();

  if (user.personal?.isLoggedIn && user.organizations.length > 0) {
    await checkAllOrganizationVersions();
  }
};

async function checkAllOrganizationVersions(): Promise<void> {
  try {
    const versionChecks = user.organizations.map(org => performVersionCheck(org.serverUrl));
    await Promise.allSettled(versionChecks);

    const orgsRequiringUpdate = user.organizations.filter(org => {
      const status = getVersionStatusForOrg(org.serverUrl);
      return status === 'updateAvailable' || status === 'belowMinimum';
    });

    if (orgsRequiringUpdate.length > 0) {
      await checkCompatibilityForUpgrades(orgsRequiringUpdate);
    }
  } catch (error) {
    console.error('Failed to check organization versions on launch:', error);
  }
}

async function checkCompatibilityForUpgrades(
  orgsRequiringUpdate: typeof user.organizations,
): Promise<void> {
  const allVersionData = getAllOrganizationVersionData();

  for (const org of orgsRequiringUpdate) {
    const versionData = allVersionData[org.serverUrl];
    if (!versionData || !versionData.latestSupportedVersion) {
      continue;
    }

    try {
      const compatibilityResult = await checkCompatibilityAcrossOrganizations(
        versionData.latestSupportedVersion,
        org.serverUrl, // Exclude the current org from conflict check
      );

      organizationCompatibilityResults.value[org.serverUrl] = compatibilityResult;

      if (compatibilityResult.hasConflict) {
        console.warn(
          `[${new Date().toISOString()}] COMPATIBILITY_CHECK App launch check for ${org.serverUrl}`,
        );
        console.warn(
          `Conflicts found with ${compatibilityResult.conflicts.length} organization(s):`,
        );
        compatibilityResult.conflicts.forEach(conflict => {
          console.warn(
            `  - ${conflict.organizationName} (${conflict.serverUrl}): Latest supported: ${conflict.latestSupportedVersion}`,
          );
        });
      } else {
        console.log(
          `[${new Date().toISOString()}] COMPATIBILITY_CHECK App launch check for ${org.serverUrl}: No conflicts`,
        );
      }
    } catch (error) {
      console.error(`Failed to check compatibility for ${org.serverUrl}:`, error);
      organizationCompatibilityResults.value[org.serverUrl] = null;
    }
  }

  if (orgsRequiringUpdate.length > 1) {
    console.log(
      `[${new Date().toISOString()}] MULTIPLE_ORGS_REQUIRING_UPDATE: ${orgsRequiringUpdate.length} organization(s) require updates`,
    );
    orgsRequiringUpdate.forEach(org => {
      const status = getVersionStatusForOrg(org.serverUrl);
      console.log(`  - ${org.nickname || org.serverUrl}: ${status}`);
    });
  }
}

/* Hooks */
onMounted(async () => {
  try {
    const useKeyChain = await getUseKeychain();
    const usersCount = await getUsersCount();
    //If multiple users, then this should get the last connected user
    //then get the claim for that user and reset only that user's data
    const accountSetupStarted = await getStoredClaim(undefined, ACCOUNT_SETUP_STARTED);

    if ((!useKeyChain && usersCount === 1) || accountSetupStarted) {
      await resetDataLocal();
      //This is a bit of a hack, if the user is NOT using keychain, then we need to
      //reload the window as the UserLogin has now loaded and thinks there are two users
      //and will display the wrong information.
      if (usersCount > 1) {
        window.location.reload();
      }
    }
  } catch {
    /* Not initialized */
  }

  precheckReady.value = true;
});

/* Watchers */
watch(
  () => user.personal,
  async () => {
    if (!user.personal?.isLoggedIn) {
      importantNoteReady.value = false;
      migrate.value = false;

      importantNoteRef.value?.initialize();
    }
  },
);
</script>

<template>
  <MandatoryUpgrade />
  <OptionalUpgrade />

  <template v-if="!user.personal?.isLoggedIn && precheckReady">
    <ImportantNote ref="importantNoteRef" @ready="handleImportantModalReady" />

    <template v-if="importantNoteReady">
      <BeginDataMigration
        ref="beginDataMigrationRef"
        @ready="handleBeginMigrationReadyState()"
        @migrate:start="migrate = true"
      />
    </template>
  </template>

  <template v-if="user.personal?.isLoggedIn">
    <AutoLoginInOrganization ref="autoLoginRef" />
  </template>
</template>
