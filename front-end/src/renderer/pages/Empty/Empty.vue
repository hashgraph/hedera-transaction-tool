<script setup lang="ts">
import { onBeforeMount } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import { isUserLoggedIn } from '@renderer/utils';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();

/* Hooks */
onBeforeMount(async () => {
  if (isUserLoggedIn(user.personal)) {
    await router.push({ name: 'transactions' });
  }
});
</script>

<template>
  <div></div>
</template>
