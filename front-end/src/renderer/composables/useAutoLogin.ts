import { onMounted } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

export default function useAutoLogin() {
  /* Stores */
  const user = useUserStore();

  /* Hooks */
  onMounted(async () => {
    const loggedUser = localStorage.getItem('htx_user');

    if (loggedUser) {
      const { userId, email }: { userId: string; email: string } = JSON.parse(loggedUser);

      user.login(userId, email);
    } else {
      user.logout();
    }
  });
}
