import { onMounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairs from '@renderer/stores/storeKeyPairs';

import { useRouter } from 'vue-router';

import { getSecretHashes } from '@renderer/services/keyPairService';

export default function useCreateTooltips() {
  /* Stores */
  const user = useUserStore();
  const keyPairs = useKeyPairs();

  /* Composables */
  const router = useRouter();

  /* State */
  const checkingForUser = ref(true);

  /* Hooks */
  onMounted(async () => {
    const loggedUser = localStorage.getItem('htx_user');

    if (loggedUser) {
      const { userId, email }: { userId: string; email: string } = JSON.parse(loggedUser);
      const secretHashes = await getSecretHashes(userId);

      user.login(userId, email, secretHashes);
      await keyPairs.refetch();

      checkingForUser.value = false;

      router.push(router.previousPath ? { path: router.previousPath } : { name: 'transactions' });
    } else {
      user.logout();
      checkingForUser.value = false;
    }
  });

  return checkingForUser;
}
