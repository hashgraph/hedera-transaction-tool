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

watch(
  () => user.personal,
  () => {
    if (!user.personal?.isLoggedIn) {
      importantNoteReady.value = false;
      migrationCheckReady.value = false;
      migrate.value = false;
    }
  },
);
</script>

<template>
  <AppUpdate />

  <template v-if="!user.personal?.isLoggedIn">
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
</template>
