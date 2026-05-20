import type { IRegisteredNode } from '@shared/interfaces';

import { computed, ref, watch } from 'vue';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { AppCache } from '@renderer/caches/AppCache';

import useAccountId from './useAccountId';

export default function useNodeId() {
  /* Stores */
  const networkStore = useNetworkStore();

  /* Composables */
  const accountData = useAccountId();

  /* Injected */
  const registeredNodeByIdCache = AppCache.inject().mirrorRegisteredNodeById;

  /* State */
  const registeredNodeId = ref<number | null>(null);
  const registeredNodeInfo = ref<IRegisteredNode | null>(null);

  /* Computed */
  const isValid = computed(() => registeredNodeInfo.value !== null);
  const key = computed(() => registeredNodeInfo.value?.admin_key);

  /* Watchers */
  watch(registeredNodeId, async () => {

    if (registeredNodeId.value !== null) {
      try {
        registeredNodeInfo.value = await registeredNodeByIdCache.lookup(
          registeredNodeId.value,
          networkStore.mirrorNodeBaseURL,
          true,
        );
      } catch {
        registeredNodeInfo.value = null;
      }
    } else {
      registeredNodeInfo.value = null;
    }
  });

  return {
    registeredNodeId,
    registeredNodeInfo,
    key,
    isValid,
    accountData,
  };
}
