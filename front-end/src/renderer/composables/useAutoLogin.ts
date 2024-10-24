import { onMounted, ref, watch, type Ref } from 'vue';
import { useRouter } from 'vue-router';

import { SELECTED_NETWORK } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getStaticUser, getUseKeychain } from '@renderer/services/safeStorageService';
import { get } from '@renderer/services/claimService';

import { safeAwait } from '@renderer/utils';

import GlobalModalLoader from '@renderer/components/GlobalModalLoader.vue';

export default function useAutoLogin(
  globalLoderRef: Ref<InstanceType<typeof GlobalModalLoader> | null>,
) {
  /* Stores */
  const user = useUserStore();
  const network = useNetworkStore();

  /* Composables */
  const router = useRouter();

  /* State */
  const finished = ref(false);

  /* Functions */
  const getSelectedNetwork = async (userId?: string) => {
    const [claim] = await get({
      where: {
        user_id: userId || '',
        claim_key: SELECTED_NETWORK,
      },
    });

    return claim?.claim_value;
  };

  const keychainLogin = async () => {
    const staticUser = await getStaticUser();
    await user.login(staticUser.id, staticUser.email, true);

    if (user.shouldSetupAccount) {
      router.push({ name: 'accountSetup' });
    }

    return staticUser.id;
  };

  const localStorageLogin = (loggedUser: string) => {
    const { userId, email }: { userId: string; email: string } = JSON.parse(loggedUser);

    setTimeout(async () => {
      await user.login(userId, email, false);
      if (user.shouldSetupAccount) {
        router.push({ name: 'accountSetup' });
      }
    }, 100);

    return userId;
  };

  /* Hooks */
  onMounted(async () => {
    router.push({ name: 'login' });

    let userId: string | undefined;

    const { data: useKeychain } = await safeAwait(getUseKeychain());
    const loggedUser = localStorage.getItem('htx_user');

    try {
      if (useKeychain) {
        userId = await keychainLogin();
      } else if (loggedUser) {
        userId = localStorageLogin(loggedUser);
      }

      const selectedNetwork = await getSelectedNetwork(userId);
      await safeAwait(network.setup(selectedNetwork));

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
