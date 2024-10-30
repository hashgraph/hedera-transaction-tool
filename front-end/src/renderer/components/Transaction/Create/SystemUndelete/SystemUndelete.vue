<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { SystemUndeleteData } from '@renderer/utils/sdk';

import { computed, reactive } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import { isContractId, isFileId } from '@renderer/utils';
import { createSystemUndeleteTransaction, getSystemUndeleteData } from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import SystemUndeleteFormData from './SystemUndeleteFormData.vue';

/* State */
const data = reactive<SystemUndeleteData>({
  fileId: '',
  contractId: '',
});

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createSystemUndeleteTransaction({
      ...common,
      ...data,
    });
});

const createDisabled = computed(() => {
  return !isFileId(data.fileId) || !isContractId(data.contractId);
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  handleUpdateData(getSystemUndeleteData(transaction));
};

const handleUpdateData = (newData: SystemUndeleteData) => {
  Object.assign(data, newData);
};

/* Functions */
const preCreateAssert = () => {
  if (!isFileId(data.fileId)) {
    throw new Error('Invalid File ID');
  }

  if (!isContractId(data.contractId)) {
    throw new Error('Invalid Contract ID');
  }
};

/* Watchers */
</script>
<template>
  <BaseTransaction
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <SystemUndeleteFormData :data="data" @update:data="handleUpdateData" />
  </BaseTransaction>
</template>
