<script setup lang="ts">
import { computed, reactive } from 'vue';
import { SystemDeleteTransaction } from '@hiero-ledger/sdk';

import {
  getTransactionCommonData,
  isContractId,
  isFileId,
  type TransactionCommonData,
} from '@renderer/utils';
import {
  createSystemDeleteTransaction,
  getSystemDeleteData,
  type SystemDeleteData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import SystemDeleteFormData from './SystemDeleteFormData.vue';

/* State */
const data = reactive<SystemDeleteData>({
  fileId: '',
  contractId: '',
  expirationTime: null,
});

/* Functions */
// The SDK models the target as a oneof (file XOR contract), so exactly one must be provided.
const hasExactlyOneTarget = () => isFileId(data.fileId) !== isContractId(data.contractId);

const assertExactlyOneTarget = () => {
  const hasFile = data.fileId.trim() !== '';
  const hasContract = data.contractId.trim() !== '';

  if (hasFile && hasContract) {
    throw new Error('Provide either a File ID or a Contract ID, not both');
  }
  if (hasFile && !isFileId(data.fileId)) {
    throw new Error('Invalid File ID');
  }
  if (hasContract && !isContractId(data.contractId)) {
    throw new Error('Invalid Contract ID');
  }
  if (!hasFile && !hasContract) {
    throw new Error('File ID or Contract ID is required');
  }
};

/* Computed */
const createDisabled = computed(() => {
  return !hasExactlyOneTarget() || !data.expirationTime;
});

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): SystemDeleteTransaction => {
  return createSystemDeleteTransaction({
    ...commonData,
    ...data,
  });
};

const getAllData = (tx: SystemDeleteTransaction): SystemDeleteData => {
  return {
    ...getTransactionCommonData(tx),
    ...getSystemDeleteData(tx),
  };
};

const handleDraftLoaded = (transaction: SystemDeleteTransaction) => {
  handleUpdateData(getSystemDeleteData(transaction));
};

const handleUpdateData = (newData: SystemDeleteData) => {
  Object.assign(data, newData);
};

const preCreateAssert = () => {
  assertExactlyOneTarget();

  if (!data.expirationTime) {
    throw new Error('Invalid Expiration Time');
  }
};

/* Watchers */
</script>
<template>
  <BaseTransaction
    :transaction-ctor="SystemDeleteTransaction"
    :create-transaction="createTransaction"
    :get-all-data="getAllData"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <SystemDeleteFormData :data="data" @update:data="handleUpdateData" />
  </BaseTransaction>
</template>
