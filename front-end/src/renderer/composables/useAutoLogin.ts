import { onMounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { getSecretHashes } from '@renderer/services/keyPairService';

export default function useCreateTooltips() {
  /* Stores */
  const user = useUserStore();

  /* State */
  const checkingForUser = ref(true);
  const hasUser = ref(false);

  /* Hooks */
  onMounted(async () => {
    const loggedUser = localStorage.getItem('htx_user');

    if (loggedUser) {
      const { userId, email }: { userId: string; email: string } = JSON.parse(loggedUser);
      const secretHashes = await getSecretHashes(userId);

      user.login(userId, email, secretHashes); // Auto-fetch key pairs after login

      hasUser.value = true;
    } else {
      user.logout();
    }

    checkingForUser.value = false;
  });

  return checkingForUser;
}
