import type { INodeInfoParsed } from 'lib';

import { computed, ref, watch } from 'vue';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { getNodeInfo } from '@renderer/services/mirrorNodeDataService';

import useAccountId from './useAccountId';

export default function useNodeId() {
  /* Stores */
  const networkStore = useNetworkStore();

  /* Composables */
  const accountData = useAccountId();

  /* State */
  const nodeId = ref<number | null>(null);
  const nodeInfo = ref<INodeInfoParsed | null>(null);

  const nodeInfoController = ref<AbortController | null>(null);

  /* Computed */
  const isValid = computed(() => Boolean(nodeInfo.value));
  const key = computed(() => nodeInfo.value?.adminKey);

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
      const nodeInfoRes = await getNodeInfo(parsedNodeId, networkStore.mirrorNodeBaseURL);

      nodeInfo.value = nodeInfoRes;

      if (nodeInfoRes?.nodeAccountId) {
        accountData.accountId.value = nodeInfoRes.nodeAccountId.toString();
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
