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
  const selectedGroupId = ref<number | null>(null);

  // Guards against an older fetch() call resolving after a newer one — only the result
  // of the most recently started call is allowed to update groups/fetching.
  let latestRequestId = 0;

  /* Actions */
  function selectGroup(id: number | null) {
    selectedGroupId.value = id;
  }

  async function fetch() {
    const requestId = ++latestRequestId;

    if (!isUserLoggedIn(user.personal) || !isLoggedInOrganization(user.selectedOrganization)) {
      if (requestId === latestRequestId) groups.value = [];
      return;
    }

    fetching.value = true;
    try {
      const result = await getReviewerGroups(user.selectedOrganization.serverUrl);
      if (requestId === latestRequestId) groups.value = result;
    } finally {
      if (requestId === latestRequestId) fetching.value = false;
    }
  }

  /* Watch */
  watch(() => user.selectedOrganization, () => fetch(), { immediate: true });

  // Keeps the current selection across a groups refetch (e.g. the ReviewerGroups.vue ->
  // createReviewerGroup -> ReviewerGroups.vue round trip, which remounts the page and would
  // otherwise lose a component-local selection) as long as it still exists in the latest
  // list; falls back to the first group otherwise (initial load, selected group deleted, or
  // an organization switch that replaced the whole list).
  watch(
    groups,
    newGroups => {
      if (!newGroups.some(group => group.id === selectedGroupId.value)) {
        selectedGroupId.value = newGroups[0]?.id ?? null;
      }
    },
    { immediate: true },
  );

  return { groups, fetching, selectedGroupId, selectGroup, fetch };
});

export default useReviewerGroupsStore;
