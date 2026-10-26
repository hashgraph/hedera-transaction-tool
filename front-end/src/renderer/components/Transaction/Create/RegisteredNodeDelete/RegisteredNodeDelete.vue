<script setup lang="ts">
import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import RegisteredNodeDeleteFormData from '@renderer/components/Transaction/Create/RegisteredNodeDelete/RegisteredNodeDeleteFormData.vue';
import {
  createRegisteredNodeDeleteTransaction,
  type RegisteredNodeDeleteData,
  type TransactionCommonData,
} from '@renderer/utils/sdk/createTransactions';

import { computed, reactive } from 'vue';
import { RegisteredNodeDeleteTransaction } from '@hiero-ledger/sdk';

import { ToastManager } from '@renderer/utils/ToastManager';
import useRegisteredNodeId from '@renderer/composables/useRegisteredNodeId';

import { getRegisteredNodeDeleteData, getTransactionCommonData } from '@renderer/utils';

/* Composables */
const toastManager = ToastManager.inject();
const nodeData = useRegisteredNodeId();

/* State */
const data = reactive<RegisteredNodeDeleteData>({
  registeredNodeId: '',
});

/* Computed */
const createDisabled = computed(() => {
  return nodeData.registeredNodeInfo.value === null;
});

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): RegisteredNodeDeleteTransaction => {
  return createRegisteredNodeDeleteTransaction({
    ...commonData,
    ...data,
  });
};

const getAllData = (tx: RegisteredNodeDeleteTransaction): RegisteredNodeDeleteData => {
  return {
    ...getTransactionCommonData(tx),
    ...getRegisteredNodeDeleteData(tx),
  };
};
const handleDraftLoaded = (transaction: RegisteredNodeDeleteTransaction) => {
  if (
    transaction instanceof RegisteredNodeDeleteTransaction &&
    transaction.registeredNodeId !== null
  ) {
    nodeData.registeredNodeId.value = transaction.registeredNodeId.toNumber();
  } else {
    nodeData.registeredNodeId.value = null;
  }
  handleUpdateData(getRegisteredNodeDeleteData(transaction));
};

const handleUpdateData = (newData: RegisteredNodeDeleteData) => {
  nodeData.registeredNodeId.value = parseInt(newData.registeredNodeId);
  Object.assign(data, newData);
};

const handleExecutedSuccess = async () => {
  toastManager.success(`Node ${data.registeredNodeId} Deleted`);
};
</script>

<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="RegisteredNodeDeleteTransaction"
    :create-transaction="createTransaction"
    :get-all-data="getAllData"
    :create-disabled="createDisabled"
    @executed:success="handleExecutedSuccess"
    @draft-loaded="handleDraftLoaded"
  >
    <template #default>
      <RegisteredNodeDeleteFormData
        :data="data as RegisteredNodeDeleteData"
        @update:data="handleUpdateData"
        required
      />
    </template>
  </BaseTransaction>
</template>
