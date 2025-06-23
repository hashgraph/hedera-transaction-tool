import { onMounted } from 'vue';

import { HTX_USER } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { getStaticUser, getUseKeychain } from '@renderer/services/safeStorageService';

import { safeAwait } from '@renderer/utils';

export default function useAutoLogin() {
  /* Stores */
  const user = useUserStore();

  /* Functions */
  const keychainLogin = async () => {
    const staticUser = await getStaticUser();
    await user.login(staticUser.id, staticUser.email, true);
    return staticUser.id;
  };

  const localStorageLogin = async (loggedUser: string) => {
    const { userId, email }: { userId: string; email: string } = JSON.parse(loggedUser);
    await user.login(userId, email, false);
    return userId;
  };

  /* Hooks */
  onMounted(async () => {
    user.logout();
  });

  return async () => {
    const { data: useKeychain } = await safeAwait(getUseKeychain());
    const loggedUser = localStorage.getItem(HTX_USER);

    if (useKeychain) {
      await keychainLogin();
    } else if (loggedUser) {
      await localStorageLogin(loggedUser);
    }
  };
}
