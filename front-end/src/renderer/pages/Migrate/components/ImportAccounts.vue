<script setup lang="ts">
import type { MigrateUserDataResult } from '@main/shared/interfaces/migration';

import { onMounted } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { migrateUserData } from '@renderer/services/migrateDataService';

import { isUserLoggedIn } from '@renderer/utils';

/* Emits */
const emit = defineEmits<{
  (event: 'importedUserData', date: MigrateUserDataResult): void;
}>();

/* Stores */
const user = useUserStore();

/* Hooks */
onMounted(async () => {
  if (!isUserLoggedIn(user.personal)) throw Error('(BUG) User is not logged in');
  emit('importedUserData', await migrateUserData(user.personal.id));
});
</script>
<template>
  <div></div>
</template>
