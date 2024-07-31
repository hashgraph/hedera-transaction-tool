import { watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

export default function useRedirectOnOnlyOrganization() {
  /* Stores */
  const user = useUserStore();

  /* Composables */
  const router = useRouter();

  /* Watchers */
  watch(
    () => user.selectedOrganization,
    () => {
      if (
        !isLoggedInOrganization(user.selectedOrganization) &&
        router.currentRoute.value.meta.onlyOrganization
      ) {
        router.push({ name: 'transactions' });
      }
    },
  );
}
