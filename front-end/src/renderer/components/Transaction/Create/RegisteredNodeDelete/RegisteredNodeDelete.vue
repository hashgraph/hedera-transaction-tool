<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import RegisteredNodeDeleteFormData from '@renderer/components/Transaction/Create/RegisteredNodeDelete/RegisteredNodeDeleteFormData.vue';
import type { RegisteredNodeDeleteData } from '@renderer/utils/sdk/createTransactions';
import { createRegisteredNodeDeleteTransaction } from '@renderer/utils/sdk/createTransactions';

import { computed, reactive } from 'vue';
import { RegisteredNodeDeleteTransaction, Transaction } from '@hiero-ledger/sdk';

import { ToastManager } from '@renderer/utils/ToastManager';
import useRegisteredNodeId from '@renderer/composables/useRegisteredNodeId';

import { getRegisteredNodeDeleteData } from '@renderer/utils';

/* Composables */
const toastManager = ToastManager.inject();
const nodeData = useRegisteredNodeId();

/* State */
const data = reactive<RegisteredNodeDeleteData>({
  registeredNodeId: '',
});

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createRegisteredNodeDeleteTransaction({
      ...common,
      ...(data),
    });
});

const createDisabled = computed(() => {
  return nodeData.registeredNodeInfo.value === null;
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
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
    :create-transaction="createTransaction"
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
