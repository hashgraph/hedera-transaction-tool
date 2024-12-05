<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { NodeData } from '@renderer/utils/sdk/createTransactions';

import { computed, reactive, ref } from 'vue';
import { Key, KeyList, Transaction } from '@hashgraph/sdk';

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
  gossipCaCertificate: new Uint8Array(),
  gossipCaCertificateText: '',
  certificateHash: '',
  adminKey: null,
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

const transactionKey = computed(() => {
  const keys: Key[] = [];
  data.adminKey && keys.push(data.adminKey);
  return new KeyList(keys);
});

/* Handlers */
async function handleDraftLoaded(transaction: Transaction) {
  handleUpdateData(await getNodeData(transaction));
}

async function handleDetailsLoaded(details: string) {
  handleUpdateData({ ...data, certificateHash: details });
}

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
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :transaction-base-key="transactionKey"
    :create-disabled="createDisabled"
    @executed:success="handleExecutedSuccess"
    @draft-loaded="handleDraftLoaded"
    @details-loaded="handleDetailsLoaded"
    :details="data.certificateHash"
  >
    <template #default>
      <NodeFormData :data="data as NodeData" @update:data="handleUpdateData" required />
    </template>
  </BaseTransaction>
</template>
