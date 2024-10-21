<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { getUseKeychain } from '@renderer/services/safeStorageService';
import { getUsersCount, resetDataLocal } from '@renderer/services/userService';

import AutoLoginInOrganization from '@renderer/components/Organization/AutoLoginInOrganization.vue';
import AppUpdate from './components/AppUpdate.vue';
import ImportantNote from './components/ImportantNote.vue';
import DetectKeychain from './components/DetectKeychain.vue';
import BeginDataMigration from './components/BeginDataMigration.vue';

/* Stores */
const user = useUserStore();

/* State */
const importantNoteRef = ref<InstanceType<typeof ImportantNote> | null>(null);
const detectKeychainRef = ref<InstanceType<typeof DetectKeychain> | null>(null);
const beginDataMigrationRef = ref<InstanceType<typeof BeginDataMigration> | null>(null);

const importantNoteReady = ref(false);
const migrationCheckReady = ref(false);
const migrate = ref(false);

/* Handlers */
const handleImportantModalReady = async () => {
  importantNoteReady.value = true;
  await beginDataMigrationRef.value?.initialize();
};

const handleBeginMigrationReady = async () => {
  migrationCheckReady.value = true;
  await detectKeychainRef.value?.initialize();
};

/* Hooks */
onMounted(async () => {
  try {
    const useKeyChain = await getUseKeychain();
    const usersCount = await getUsersCount();

    if (!useKeyChain && usersCount === 1) {
      await resetDataLocal();
    }
  } catch {
    /* Not initialized */
  }
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

  <template v-if="!user.personal?.isLoggedIn">
    <ImportantNote ref="importantNoteRef" @ready="handleImportantModalReady" />

    <template v-if="importantNoteReady">
      <BeginDataMigration
        ref="beginDataMigrationRef"
        @ready="handleBeginMigrationReady"
        @start-migrate="migrate = true"
      />
    </template>

    <template v-if="importantNoteReady && migrationCheckReady && !migrate">
      <DetectKeychain ref="detectKeychainRef" />
    </template>
  </template>

  <template v-if="importantNoteReady && migrationCheckReady">
    <AutoLoginInOrganization />
  </template>
</template>
