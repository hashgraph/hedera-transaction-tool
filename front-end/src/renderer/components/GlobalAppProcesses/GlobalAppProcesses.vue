<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import { ACCOUNT_SETUP_STARTED } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import useAutoLogin from '@renderer/composables/useAutoLogin';
import useLoader from '@renderer/composables/useLoader';
import useSetupStores from '@renderer/composables/user/useSetupStores';
import useRecoveryPhraseHashMigrate from '@renderer/composables/useRecoveryPhraseHashMigrate';
import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';

import { getUseKeychain } from '@renderer/services/safeStorageService';
import { getUsersCount, resetDataLocal } from '@renderer/services/userService';
import { getStoredClaim } from '@renderer/services/claimService';

import AutoLoginInOrganization from '@renderer/components/Organization/AutoLoginInOrganization.vue';
import AppUpdate from './components/AppUpdate.vue';
import ImportantNote from './components/ImportantNote.vue';
import BeginDataMigration from './components/BeginDataMigration.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const withLoader = useLoader();
const tryAutoLogin = useAutoLogin();
const setupStores = useSetupStores();
const { select: selectDefaultOrganization } = useDefaultOrganization();
const { redirectIfRequiredKeysToMigrate } = useRecoveryPhraseHashMigrate();

/* State */
const importantNoteRef = ref<InstanceType<typeof ImportantNote> | null>(null);
const beginDataMigrationRef = ref<InstanceType<typeof BeginDataMigration> | null>(null);

const precheckReady = ref(false);
const importantNoteReady = ref(false);
const migrate = ref(false);

/* Handlers */
const handleImportantModalReady = async () => {
  importantNoteReady.value = true;
  await beginDataMigrationRef.value?.initialize();
};

const handleBeginMigrationReadyState = async () => {
  await withLoader(tryAutoLogin);

  const redirect = await redirectIfRequiredKeysToMigrate();
  if (!redirect) {
    await withLoader(selectDefaultOrganization);
  }

  await user.refetchOrganizations();
  await setupStores();
};

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
  <AppUpdate />

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
    <AutoLoginInOrganization />
  </template>
</template>
