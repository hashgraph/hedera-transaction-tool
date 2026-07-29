import { Key } from '@hiero-ledger/sdk';
import type { INodeInfoParsed } from '@shared/interfaces';

import { computed, ref, watch, type Ref } from 'vue';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { AppCache } from '@renderer/caches/AppCache';

import useAccountId, { type AccountIdStore } from './useAccountId';

export interface NodeIdStore {
  nodeId: Ref<number | null>;
  nodeInfo: Ref<INodeInfoParsed | null>;
  key: Ref<Key | null>;
  isValid: Ref<boolean>;
  accountData: AccountIdStore;
}

export default function useNodeId(): NodeIdStore {
  /* Stores */
  const networkStore = useNetworkStore();

  /* Composables */
  const accountData = useAccountId();

  /* Injected */
  const nodeByIdCache = AppCache.inject().mirrorNodeById;

  /* State */
  const nodeId = ref<number | null>(null);
  const nodeInfo: Ref<INodeInfoParsed | null> = ref(null);

  const nodeInfoController = ref<AbortController | null>(null);

  /* Computed */
  const isValid = computed(() => Boolean(nodeInfo.value));
  const key = computed(() => nodeInfo.value?.admin_key ?? null);

  /* Watchers */
  watch(nodeId, async newNodeId => {
    cancelPreviousRequests();

    const parsedNodeId = parseInt(newNodeId?.toString() || '');

    if (isNaN(parsedNodeId)) return resetData();

    try {
      if (isNaN(parsedNodeId)) {
        throw new Error('Invalid node ID');
      }

      nodeInfoController.value = new AbortController();
      const nodeInfoRes = await nodeByIdCache.lookup(parsedNodeId, networkStore.mirrorNodeBaseURL, true);

      nodeInfo.value = nodeInfoRes;

      if (nodeInfoRes?.node_account_id) {
        accountData.accountId.value = nodeInfoRes.node_account_id.toString();
      }
    } catch {
      resetData();
    }
  });

  /* Misc */
  function resetData() {
    nodeInfo.value = null;
  }

  function cancelPreviousRequests() {
    nodeInfoController.value?.abort();
    nodeInfoController.value = null;
  }

  return {
    nodeId,
    nodeInfo,
    key,
    isValid,
    accountData,
  };
}
