<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { NodeData } from '@renderer/utils/sdk/createTransactions';

import { computed, reactive, ref, watch } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';

import useUserStore from '@renderer/stores/storeUser';

import { getNodeData, isUserLoggedIn } from '@renderer/utils';
import { createNodeCreateTransaction } from '@renderer/utils/sdk/createTransactions';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import NodeFormData from '@renderer/components/Transaction/Create/NodeCreate/NodeFormData.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<NodeData>({
  nodeAccountId: '',
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
    createNodeCreateTransaction({
      ...common,
      ...(data as NodeData),
    });
});

const createDisabled = computed(() => {
  return !data.adminKey;
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  handleUpdateData(getNodeData(transaction));
};

const handleUpdateData = (newData: NodeData) => {
  Object.assign(data, newData);
};

const handleExecutedSuccess = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  toast.success(`Node ${data.nodeAccountId} Created`);
};

/* Functions */
const preCreateAssert = () => {
  if (!data.nodeAccountId) {
    throw new Error('Node Account ID Required');
  }

  if (data.gossipEndpoints.length == 0) {
    throw new Error('Gossip Endpoints Required');
  }

  if (data.serviceEndpoints.length == 0) {
    throw new Error('Service Endpoints Required');
  }

  if (!data.gossipCaCertificate) {
    throw new Error('Gossip CA Certificate Required');
  }

  if (!data.adminKey) {
    throw new Error('Admin Key Required');
  }

  return true;
};

/* Watchers */
watch(
  () => [data.nodeAccountId, data.adminKey],
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
    :create-disabled="createDisabled"
    @executed:success="handleExecutedSuccess"
    @draft-loaded="handleDraftLoaded"
  >
    <template #default>
      <NodeFormData :data="data as NodeData" @update:data="handleUpdateData" required />
    </template>
  </BaseTransaction>
</template>
