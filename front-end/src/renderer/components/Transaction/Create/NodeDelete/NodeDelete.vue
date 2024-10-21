<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { ExecutedSuccessData } from '@renderer/components/Transaction/TransactionProcessor';
import type { NodeDeleteData } from '@renderer/utils/sdk/createTransactions';

import { computed, reactive, ref } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';

import useUserStore from '@renderer/stores/storeUser';

import { createNodeDeleteTransaction } from '@renderer/utils/sdk/createTransactions';

import {
  getNodeDeleteData,
  getEntityIdFromTransactionReceipt,
  isUserLoggedIn,
} from '@renderer/utils';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import NodeDeleteFormData from '@renderer/components/Transaction/Create/NodeDelete/NodeDeleteFormData.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<NodeDeleteData>({
  nodeId: '',
});

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createNodeDeleteTransaction({
      ...common,
      ...(data as NodeDeleteData),
    });
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  handleUpdateData(getNodeDeleteData(transaction));
};

const handleUpdateData = (newData: NodeDeleteData) => {
  Object.assign(data, newData);
};

const handleExecutedSuccess = async ({ receipt }: ExecutedSuccessData) => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const accountId = getEntityIdFromTransactionReceipt(receipt, 'accountId');

  toast.success(`Node ${accountId} Deleted`, { position: 'bottom-right' });
};

/* Functions */
const preCreateAssert = () => {
  return true;
};
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
      <NodeDeleteFormData :data="data as NodeDeleteData" @update:data="handleUpdateData" />
    </template>
  </BaseTransaction>
</template>
