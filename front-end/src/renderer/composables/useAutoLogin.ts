import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

import { getStaticUser, getUseKeychain } from '@renderer/services/safeStorageService';

export default function useAutoLogin() {
  /* Stores */
  const user = useUserStore();

  /* Composables */
  const router = useRouter();

  /* Hooks */
  onMounted(async () => {
    router.push({ name: 'login' });

    try {
      const useKeychain = await getUseKeychain();
      if (useKeychain) {
        const staticUser = await getStaticUser();
        await user.login(staticUser.id, staticUser.email, true);
        if (user.shouldSetupAccount) {
          router.push({ name: 'accountSetup' });
        }
        return;
      }
    } catch {
      /* Do nothing */
    }

    const loggedUser = localStorage.getItem('htx_user');
    if (loggedUser) {
      const { userId, email }: { userId: string; email: string } = JSON.parse(loggedUser);
      setTimeout(async () => {
        await user.login(userId, email, false);
        if (user.shouldSetupAccount) {
          router.push({ name: 'accountSetup' });
        }
      }, 100);
    } else {
      await user.logout();
    }
  });
}
