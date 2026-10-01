import type { IReviewerGroupSummary } from '@shared/interfaces';

import { ref, watch } from 'vue';
import { defineStore } from 'pinia';

import useUserStore from './storeUser';

import { getReviewerGroups } from '@renderer/services/organization';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

const useReviewerGroupsStore = defineStore('reviewerGroups', () => {
  const user = useUserStore();

  /* State */
  const groups = ref<IReviewerGroupSummary[]>([]);
  const fetching = ref(false);

  /* Actions */
  async function fetch() {
    if (!isUserLoggedIn(user.personal) || !isLoggedInOrganization(user.selectedOrganization)) {
      groups.value = [];
      return;
    }

    fetching.value = true;
    try {
      groups.value = await getReviewerGroups(user.selectedOrganization.serverUrl);
    } finally {
      fetching.value = false;
    }
  }

  /* Watch */
  watch(() => user.selectedOrganization, () => fetch(), { immediate: true });

  return { groups, fetching, fetch };
});

export default useReviewerGroupsStore;
