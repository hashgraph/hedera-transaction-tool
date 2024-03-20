<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairs from '@renderer/stores/storeKeyPairs';

import { useRouter } from 'vue-router';

import { getSecretHashes } from '@renderer/services/keyPairService';

import UserLogin from './components/UserLogin.vue';

/* Stores */
const user = useUserStore();
const keyPairs = useKeyPairs();

/* Composables */
const router = useRouter();

/* State */
const checkingForUser = ref(true);

/* Hooks */
onBeforeMount(async () => {
  const loggedUser = localStorage.getItem('htx_user');
  if (loggedUser) {
    const { userId, email }: { userId: string; email: string } = JSON.parse(loggedUser);
    const secretHashes = await getSecretHashes(userId);
    router.push({ name: 'transactions' });
    user.login(userId, email, secretHashes);
    await keyPairs.refetch();
  }

  checkingForUser.value = false;
});
</script>
<template>
  <div class="p-10 flex-column flex-centered flex-1 overflow-hidden">
    <UserLogin v-if="!checkingForUser" />
  </div>
</template>
