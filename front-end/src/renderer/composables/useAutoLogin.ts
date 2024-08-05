import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

export default function useAutoLogin() {
  /* Stores */
  const user = useUserStore();

  /* Composables */
  const router = useRouter();

  /* Hooks */
  onMounted(async () => {
    const loggedUser = localStorage.getItem('htx_user');

    if (loggedUser) {
      const { userId, email }: { userId: string; email: string } = JSON.parse(loggedUser);

      setTimeout(async () => {
        await user.login(userId, email);
        if (user.shouldSetupAccount) {
          router.push({ name: 'accountSetup' });
        }
      }, 100);
    } else {
      await user.logout();
    }
  });
}
