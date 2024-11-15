<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { NodeDeleteData } from '@renderer/utils/sdk/createTransactions';

import { computed, reactive, ref } from 'vue';
import { NodeDeleteTransaction, Transaction } from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';
import useNodeId from '@renderer/composables/useNodeId';

import { createNodeDeleteTransaction } from '@renderer/utils/sdk/createTransactions';

import { getNodeDeleteData } from '@renderer/utils';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import NodeDeleteFormData from '@renderer/components/Transaction/Create/NodeDelete/NodeDeleteFormData.vue';

/* Composables */
const toast = useToast();
const nodeData = useNodeId();

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

const createDisabled = computed(() => {
  return !nodeData.isValid.value;
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
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
  toast.success(`Node ${data.nodeId} Deleted`, { position: 'bottom-right' });
};

/* Functions */
const preCreateAssert = () => {
  if (!data.nodeId) {
    throw new Error('Node ID Required');
  }
};
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
      <NodeDeleteFormData :data="data as NodeDeleteData" @update:data="handleUpdateData" />
    </template>
  </BaseTransaction>
</template>
