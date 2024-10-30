<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { SystemDeleteData } from '@renderer/utils/sdk';

import { computed, reactive } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import { isContractId, isFileId } from '@renderer/utils';
import { createSystemDeleteTransaction, getSystemDeleteData } from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import SystemDeleteFormData from './SystemDeleteFormData.vue';

/* State */
const data = reactive<SystemDeleteData>({
  fileId: '',
  contractId: '',
  expirationTime: null,
});

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createSystemDeleteTransaction({
      ...common,
      ...data,
    });
});

const createDisabled = computed(() => {
  return !isFileId(data.fileId) || !isContractId(data.contractId) || !data.expirationTime;
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  handleUpdateData(getSystemDeleteData(transaction));
};

const handleUpdateData = (newData: SystemDeleteData) => {
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

  if (!data.expirationTime) {
    throw new Error('Invalid Expiration Time');
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
    <SystemDeleteFormData :data="data" @update:data="handleUpdateData" />
  </BaseTransaction>
</template>
