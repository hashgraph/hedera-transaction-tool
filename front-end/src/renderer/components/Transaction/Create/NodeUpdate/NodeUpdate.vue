<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { ExecutedSuccessData } from '@renderer/components/Transaction/TransactionProcessor';
import type { NodeUpdateData } from '@renderer/utils/sdk/createTransactions';

import { computed, reactive, ref } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';

import useUserStore from '@renderer/stores/storeUser';

import { createNodeUpdateTransaction } from '@renderer/utils/sdk/createTransactions';

import {
  getNodeUpdateData,
  getEntityIdFromTransactionReceipt,
  isUserLoggedIn,
} from '@renderer/utils';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import NodeUpdateFormData from '@renderer/components/Transaction/Create/NodeUpdate/NodeUpdateFormData.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<NodeUpdateData>({
  nodeAccountId: '',
  nodeId: '',
  description: '',
  gossipEndpoints: [],
  serviceEndpoints: [],
  gossipCaCertificate: '',
  certificateHash: '',
  adminKey: null,
});

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createNodeUpdateTransaction({
      ...common,
      ...(data as NodeUpdateData),
    });
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  handleUpdateData(getNodeUpdateData(transaction));
};

const handleUpdateData = (newData: NodeUpdateData) => {
  Object.assign(data, newData);
};

const handleExecutedSuccess = async ({ receipt }: ExecutedSuccessData) => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const accountId = getEntityIdFromTransactionReceipt(receipt, 'accountId');

  toast.success(`Node ${accountId} Updated`, { position: 'bottom-right' });
};

/* Functions */
const preCreateAssert = () => {
  if (!data.nodeId) {
    throw new Error('Node ID Required');
  }

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
      <NodeUpdateFormData :data="data as NodeUpdateData" @update:data="handleUpdateData" />
    </template>
  </BaseTransaction>
</template>
