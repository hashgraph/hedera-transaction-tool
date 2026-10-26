<script setup lang="ts">
import { computed, reactive } from 'vue';
import { NodeDeleteTransaction } from '@hiero-ledger/sdk';

import { ToastManager } from '@renderer/utils/ToastManager';
import useNodeId from '@renderer/composables/useNodeId';

import {
  createNodeDeleteTransaction,
  type NodeDeleteData,
  type TransactionCommonData,
} from '@renderer/utils/sdk/createTransactions';

import { getNodeDeleteData, getTransactionCommonData } from '@renderer/utils';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import NodeDeleteFormData from '@renderer/components/Transaction/Create/NodeDelete/NodeDeleteFormData.vue';

/* Composables */
const toastManager = ToastManager.inject();
const nodeData = useNodeId();

/* State */
const data = reactive<NodeDeleteData>({
  nodeId: '',
});

/* Computed */
const createDisabled = computed(() => {
  return !nodeData.nodeInfo?.value;
});

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): NodeDeleteTransaction => {
  return createNodeDeleteTransaction({
    ...commonData,
    ...data,
  });
};

const getAllData = (tx: NodeDeleteTransaction): NodeDeleteData => {
  return {
    ...getTransactionCommonData(tx),
    ...getNodeDeleteData(tx),
  };
};

const handleDraftLoaded = (transaction: NodeDeleteTransaction) => {
  if (transaction instanceof NodeDeleteTransaction) {
    if (transaction.nodeId) {
      nodeData.nodeId.value = transaction.nodeId.toNumber();
    }
  }
  handleUpdateData(getNodeDeleteData(transaction));
};

const handleUpdateData = (newData: NodeDeleteData) => {
  nodeData.nodeId.value = parseInt(newData.nodeId);
  Object.assign(data, newData);
};

const handleExecutedSuccess = async () => {
  toastManager.success(`Node ${data.nodeId} Deleted`);
};
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="NodeDeleteTransaction"
    :create-transaction="createTransaction"
    :get-all-data="getAllData"
    :create-disabled="createDisabled"
    @executed:success="handleExecutedSuccess"
    @draft-loaded="handleDraftLoaded"
  >
    <template #default>
      <NodeDeleteFormData :data="data as NodeDeleteData" @update:data="handleUpdateData" />
    </template>
  </BaseTransaction>
</template>
