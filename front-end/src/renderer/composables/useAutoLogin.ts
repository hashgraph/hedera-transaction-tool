import { onMounted, ref, watch, type Ref } from 'vue';
import { useRouter } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

import { getStaticUser, getUseKeychain } from '@renderer/services/safeStorageService';

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

        finished.value = true;
        globalLoderRef.value?.close();

        return;
      }
    } catch {
      /* Do nothing */
    }

    try {
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
    } finally {
      finished.value = true;
      globalLoderRef.value?.close();
    }
  });

  watch(globalLoderRef, newRef => {
    if (!finished.value) newRef?.open();
  });
}
