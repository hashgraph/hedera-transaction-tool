import type { IRegisteredNodeInfoParsed } from '@shared/interfaces';
import type { Key } from '@hiero-ledger/sdk';

import { computed, ref, watch, type Ref } from 'vue';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { AppCache } from '@renderer/caches/AppCache';

import useAccountId, { type AccountIdStore } from './useAccountId';

export interface RegisteredNotIdStore {
  registeredNodeId: Ref<number | null>;
  registeredNodeInfo: Ref<IRegisteredNodeInfoParsed | null>;
  key: Ref<Key | null>;
  isValid: Ref<boolean>;
  accountData: AccountIdStore;
}

export default function useRegisteredNodeId(): RegisteredNotIdStore {
  /* Stores */
  const networkStore = useNetworkStore();

  /* Composables */
  const accountData = useAccountId();

  /* Injected */
  const registeredNodeByIdCache = AppCache.inject().mirrorRegisteredNodeById;

  /* State */
  const registeredNodeId = ref<number | null>(null);
  const registeredNodeInfo: Ref<IRegisteredNodeInfoParsed | null> = ref(null);

  /* Computed */
  const isValid = computed(() => registeredNodeInfo.value !== null);
  const key = computed(() => registeredNodeInfo.value?.admin_key ?? null);

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
