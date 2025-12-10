<script setup lang="ts">
import type { INodeInfoParsed } from '@shared/interfaces';
import type { NodeUpdateData } from '@renderer/utils/sdk/createTransactions';
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';

import { computed, reactive, ref, watch } from 'vue';
import { NodeUpdateTransaction, Transaction } from '@hashgraph/sdk';

import { useRoute } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useAccountId from '@renderer/composables/useAccountId';
import useNodeId from '@renderer/composables/useNodeId';

import { createNodeUpdateTransaction } from '@renderer/utils/sdk/createTransactions';
import { getComponentServiceEndpoint, getNodeUpdateData } from '@renderer/utils';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import NodeUpdateFormData from '@renderer/components/Transaction/Create/NodeUpdate/NodeUpdateFormData.vue';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Composables */
const route = useRoute();
const toast = useToast();
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
  nodeData.nodeId.value = parseInt(newData.nodeId);
  newNodeAccountData.accountId.value = newData.nodeAccountId;
  Object.assign(data, newData);
};

const handleExecutedSuccess = async () => {
  toast.success(`Node ${data.nodeAccountId} Updated`, successToastOptions);
};

/* Functions */
const preCreateAssert = () => {
  if (!data.nodeId) {
    throw new Error('Node ID Required');
  }
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
    :pre-create-assert="preCreateAssert"
    @executed:success="handleExecutedSuccess"
    @draft-loaded="handleDraftLoaded"
  >
    <template #default>
      <NodeUpdateFormData :data="data as NodeUpdateData" @update:data="handleUpdateData" />
    </template>
  </BaseTransaction>
</template>
