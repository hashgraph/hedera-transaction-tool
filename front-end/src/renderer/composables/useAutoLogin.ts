import { onMounted, ref, watch, type Ref } from 'vue';
import { useRouter } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

import { getStaticUser, getUseKeychain } from '@renderer/services/safeStorageService';

import { safeAwait } from '@renderer/utils';

import GlobalModalLoader from '@renderer/components/GlobalModalLoader.vue';

export default function useAutoLogin(
  globalLoderRef: Ref<InstanceType<typeof GlobalModalLoader> | null>,
) {
  /* Stores */
  const user = useUserStore();

  /* Composables */
  const router = useRouter();

  /* State */
  const finished = ref(false);

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

  const addLoaderTimeout = () => {
    setTimeout(() => {
      if (!finished.value) {
        globalLoderRef.value?.close();
      }
    }, 10_000);
  };

  /* Hooks */
  onMounted(async () => {
    addLoaderTimeout();

    router.push({ name: 'login' });

    let userId: string | undefined;

    const { data: useKeychain } = await safeAwait(getUseKeychain());
    const loggedUser = localStorage.getItem('htx_user');

    try {
      if (useKeychain) {
        userId = await keychainLogin();
      } else if (loggedUser) {
        userId = await localStorageLogin(loggedUser);
      }

      if (user.shouldSetupAccount) {
        router.push({ name: 'accountSetup' });
      }

      if (!userId) {
        await user.logout();
      }
    } finally {
      finished.value = true;
      globalLoderRef.value?.close();
    }
  });

  watch(globalLoderRef, newRef => {
    if (!finished.value) newRef?.open();
  });
}
