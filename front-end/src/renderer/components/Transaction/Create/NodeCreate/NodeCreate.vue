<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';
import { NodeCreateTransaction } from '@hiero-ledger/sdk';

import { ToastManager } from '@renderer/utils/ToastManager';

import useUserStore from '@renderer/stores/storeUser';

import {
  getNodeData,
  getTransactionCommonData,
  isUserLoggedIn,
  type TransactionCommonData,
} from '@renderer/utils';
import { createNodeCreateTransaction, type NodeData } from '@renderer/utils/sdk/createTransactions';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import NodeFormData from '@renderer/components/Transaction/Create/NodeCreate/NodeFormData.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toastManager = ToastManager.inject();

/* State */
const baseTransactionRef = ref<ComponentExposed<typeof BaseTransaction> | null>(null);

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
  associatedRegisteredNodes: [],
});

/* Computed */
const createDisabled = computed(() => {
  return !data.adminKey;
});

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): NodeCreateTransaction => {
  return createNodeCreateTransaction({
    ...commonData,
    ...data,
  });
};

const getAllData = (tx: NodeCreateTransaction): NodeData => {
  return {
    ...getTransactionCommonData(tx),
    ...getNodeData(tx, null),
  };
};

const handleDraftLoaded = (transaction: NodeCreateTransaction) => {
  handleUpdateData(getNodeData(transaction, null));
};

const handleUpdateData = (newData: NodeData) => {
  Object.assign(data, newData);
};

const handleExecutedSuccess = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  toastManager.success(`Node ${data.nodeAccountId} Created`);
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
    :transaction-ctor="NodeCreateTransaction"
    :create-transaction="createTransaction"
    :get-all-data="getAllData"
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
