<script setup lang="ts">
import type { GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

import { inject, onMounted, ref, watch } from 'vue';

import { MIGRATION_STARTED } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import useAutoLogin from '@renderer/composables/useAutoLogin';

import { getUseKeychain } from '@renderer/services/safeStorageService';
import { getUsersCount, resetDataLocal } from '@renderer/services/userService';
import { getStoredClaim } from '@renderer/services/claimService';

import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

import { withLoader } from '@renderer/utils';

import AutoLoginInOrganization from '@renderer/components/Organization/AutoLoginInOrganization.vue';
import AppUpdate from './components/AppUpdate.vue';
import ImportantNote from './components/ImportantNote.vue';
import DetectKeychain from './components/DetectKeychain.vue';
import BeginDataMigration from './components/BeginDataMigration.vue';

/* Stores */
const user = useUserStore();

/* Injected */
const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

/* Composables */
const toast = useToast();
const tryAutoLogin = useAutoLogin();

/* State */
const importantNoteRef = ref<InstanceType<typeof ImportantNote> | null>(null);
const detectKeychainRef = ref<InstanceType<typeof DetectKeychain> | null>(null);
const beginDataMigrationRef = ref<InstanceType<typeof BeginDataMigration> | null>(null);

const precheckReady = ref(false);
const importantNoteReady = ref(false);
const migrationCheckReady = ref(false);
const detectKeychainReady = ref(false);
const migrate = ref(false);

/* Handlers */
const handleImportantModalReady = async () => {
  importantNoteReady.value = true;
  await beginDataMigrationRef.value?.initialize();
};

const handleBeginMigrationReadyState = async (ready: boolean) => {
  migrationCheckReady.value = ready;
  if (ready) {
    await detectKeychainRef.value?.initialize();
  }
};

const handleDetectKeychainReadyState = () => {
  detectKeychainReady.value = true;
  withLoader(tryAutoLogin, toast, globalModalLoaderRef?.value)();
};

/* Hooks */
onMounted(async () => {
  try {
    const useKeyChain = await getUseKeychain();
    const usersCount = await getUsersCount();
    const migrationStarted = await getStoredClaim(undefined, MIGRATION_STARTED);

    if ((!useKeyChain && usersCount === 1) || migrationStarted) {
      await resetDataLocal();
      precheckReady.value = true;
    }
  } catch {
    /* Not initialized */
  }

  precheckReady.value = true;
});

watch(
  () => user.personal,
  async () => {
    if (!user.personal?.isLoggedIn) {
      importantNoteReady.value = false;
      migrationCheckReady.value = false;
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
        @ready="handleBeginMigrationReadyState(true)"
        @ready:not="handleBeginMigrationReadyState(false)"
        @migrate:start="migrate = true"
      />
    </template>
    <template v-if="importantNoteReady && migrationCheckReady && !migrate">
      <DetectKeychain ref="detectKeychainRef" @ready="handleDetectKeychainReadyState" />
    </template>
  </template>

  <template v-if="detectKeychainReady">
    <AutoLoginInOrganization />
  </template>
</template>
