<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { getUseKeychain } from '@renderer/services/safeStorageService';
import { getUsersCount, resetDataLocal } from '@renderer/services/userService';

import AutoLoginInOrganization from '@renderer/components/Organization/AutoLoginInOrganization.vue';
import AppUpdate from './components/AppUpdate.vue';
import ImportantNote from './components/ImportantNote.vue';
import DetectKeychain from './components/DetectKeychain.vue';
import BeginDataMigration from './components/BeginDataMigration.vue';

/* State */
const importantNoteReady = ref(false);
const migrationCheckReady = ref(false);
const migrate = ref(false);

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
</script>

<template>
  <AppUpdate />
  <ImportantNote @ready="importantNoteReady = true" />

  <template v-if="importantNoteReady">
    <BeginDataMigration @ready="migrationCheckReady = true" @start-migrate="migrate = true" />
  </template>

  <template v-if="importantNoteReady && migrationCheckReady">
    <AutoLoginInOrganization />

    <template v-if="!migrate">
      <DetectKeychain />
    </template>
  </template>
</template>
