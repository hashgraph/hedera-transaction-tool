<script setup lang="ts">
import { onMounted } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { migrateAccountsData } from '@renderer/services/migrateDataService';

import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

/* Emits */
const emit = defineEmits<{
  (event: 'importedAccounts', count: number): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Hooks */
onMounted(async () => {
  if (!isUserLoggedIn(user.personal)) throw Error('(BUG) User is not logged in');
  emit('importedAccounts', await migrateAccountsData(user.personal.id, network.network));
});
</script>
<template>
  <div></div>
</template>
