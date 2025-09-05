<script setup lang="ts">
import type { MigrateUserDataResult } from '@shared/interfaces/migration';

import { onMounted } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { migrateUserData } from '@renderer/services/migrateDataService';

import { isUserLoggedIn } from '@renderer/utils';

/* Emits */
const emit = defineEmits<{
  (event: 'importedUserData', date: MigrateUserDataResult): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Hooks */
onMounted(async () => {
  if (!isUserLoggedIn(user.personal)) throw Error('(BUG) User is not logged in');
  const migratedUserData = await migrateUserData(user.personal.id);
  await network.setup(migratedUserData.currentNetwork);
  emit('importedUserData', migratedUserData);
});
</script>
<template>
  <div></div>
</template>
