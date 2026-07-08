<script setup lang="ts">
import type { INodeInfoParsed } from '@shared/interfaces';
import type {
  ComponentServiceEndpoint,
  NodeUpdateData,
} from '@renderer/utils/sdk/createTransactions';
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';

import { computed, reactive, ref, watch } from 'vue';
import { NodeUpdateTransaction, Transaction } from '@hiero-ledger/sdk';

import { useRoute } from 'vue-router';
import { ToastManager } from '@renderer/utils/ToastManager';
import useAccountId from '@renderer/composables/useAccountId';
import useNodeId from '@renderer/composables/useNodeId';

import { createNodeUpdateTransaction } from '@renderer/utils/sdk/createTransactions';
import { compareKeys, getComponentServiceEndpoint, getNodeUpdateData } from '@renderer/utils';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import NodeUpdateFormData from '@renderer/components/Transaction/Create/NodeUpdate/NodeUpdateFormData.vue';

/* Composables */
const route = useRoute();
const toastManager = ToastManager.inject();
const nodeData = useNodeId();
const newNodeAccountData = useAccountId();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<NodeUpdateData>({
  nodeAccountId: '',
  nodeId: '',
  description: '',
  gossipEndpoints: [],
  serviceEndpoints: [],
  grpcWebProxyEndpoint: null,
  gossipCaCertificate: Uint8Array.from([]),
  certificateHash: Uint8Array.from([]),
  adminKey: null,
  declineReward: false,
  associatedRegisteredNodes: [],
});

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createNodeUpdateTransaction(
      {
        ...common,
        ...(data as NodeUpdateData),
      },
      (nodeData.nodeInfo?.value as INodeInfoParsed) || null,
    );
});

const hasAnyChange = computed(() => {
  const nodeInfo = nodeData.nodeInfo?.value as INodeInfoParsed | null;
  if (!nodeInfo) return false;

  if ((data.description ?? '') !== (nodeInfo.description ?? '')) return true;

  if (data.nodeAccountId !== (nodeInfo.node_account_id?.toString() ?? '')) return true;

  if (data.gossipEndpoints.length > 0) return true;
  if (data.serviceEndpoints.length > 0) return true;

  const initialGrpc = getComponentServiceEndpoint(nodeInfo.grpc_web_proxy_endpoint);
  const currentGrpc = data.grpcWebProxyEndpoint;
  const endpointKey = (ep: ComponentServiceEndpoint | null) =>
    ep ? `${ep.ipAddressV4}|${ep.domainName}|${ep.port}` : '';
  if (endpointKey(initialGrpc) !== endpointKey(currentGrpc)) return true;

  if (data.gossipCaCertificate.length > 0) return true;
  if (data.certificateHash.length > 0) return true;

  if (data.adminKey && nodeInfo.admin_key) {
    if (!compareKeys(data.adminKey, nodeInfo.admin_key)) return true;
  } else if (data.adminKey || nodeInfo.admin_key) {
    return true;
  }

  if (data.declineReward !== nodeInfo.decline_reward) return true;

  const oldNodes = [...nodeInfo.associated_registered_nodes].map(String).sort().join(',');
  const newNodes = [...data.associatedRegisteredNodes].sort().join(',');
  if (oldNodes !== newNodes) return true;

  return false;
});

const createDisabled = computed(() => {
  return !nodeData.nodeInfo?.value || !hasAnyChange.value;
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  if (transaction instanceof NodeUpdateTransaction) {
    if (transaction.nodeId) {
      nodeData.nodeId.value = transaction.nodeId.toNumber();
    }
    if (transaction.accountId) {
      newNodeAccountData.accountId.value = transaction.accountId.toString();
    }
  }
  handleUpdateData(getNodeUpdateData(transaction));
};

const handleUpdateData = (newData: NodeUpdateData) => {
  const n = parseInt(newData.nodeId);
  nodeData.nodeId.value = isNaN(n) ? null : n;
  newNodeAccountData.accountId.value = newData.nodeAccountId;
  Object.assign(data, newData);
};

const handleExecutedSuccess = async () => {
  toastManager.success(`Node ${data.nodeAccountId} Updated`);
};

/* Watchers */
watch(nodeData.nodeInfo, nodeInfo => {
  if (!nodeInfo) {
    data.nodeAccountId = '';
    newNodeAccountData.accountId.value = '';
    data.description = '';
    data.gossipEndpoints = [];
    data.serviceEndpoints = [];
    data.gossipCaCertificate = Uint8Array.from([]);
    data.grpcWebProxyEndpoint = null;
    data.certificateHash = Uint8Array.from([]);
    data.adminKey = null;
    data.declineReward = false;
    data.associatedRegisteredNodes = [];
  } else if (!route.query.draftId) {
    data.nodeAccountId = nodeInfo.node_account_id?.toString() || '';
    newNodeAccountData.accountId.value = data.nodeAccountId;
    data.description = nodeInfo.description || '';
    data.gossipEndpoints = [];
    data.serviceEndpoints = [];
    data.grpcWebProxyEndpoint = getComponentServiceEndpoint(nodeInfo.grpc_web_proxy_endpoint);
    data.gossipCaCertificate = Uint8Array.from([]);
    data.certificateHash = Uint8Array.from([]);
    data.adminKey = nodeInfo.admin_key;
    data.declineReward = nodeInfo.decline_reward;
    data.associatedRegisteredNodes = nodeInfo.associated_registered_nodes.map(String);
  }
});
watch(
  () => [data.nodeAccountId, data.adminKey, data.nodeId],
  () => {
    baseTransactionRef.value?.updateTransactionKey();
  },
);
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :create-transaction="createTransaction"
    :create-disabled="createDisabled"
    @executed:success="handleExecutedSuccess"
    @draft-loaded="handleDraftLoaded"
  >
    <template #default>
      <NodeUpdateFormData :data="data as NodeUpdateData" @update:data="handleUpdateData" />
    </template>
  </BaseTransaction>
</template>
