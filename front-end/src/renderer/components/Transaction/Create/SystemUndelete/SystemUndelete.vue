<script setup lang="ts">
import { computed, reactive } from 'vue';
import { SystemUndeleteTransaction } from '@hiero-ledger/sdk';

import {
  getTransactionCommonData,
  isContractId,
  isFileId,
  type TransactionCommonData,
} from '@renderer/utils';
import {
  createSystemUndeleteTransaction,
  getSystemUndeleteData,
  type SystemUndeleteData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import SystemUndeleteFormData from './SystemUndeleteFormData.vue';

/* State */
const data = reactive<SystemUndeleteData>({
  fileId: '',
  contractId: '',
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
  return !hasExactlyOneTarget();
});

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): SystemUndeleteTransaction => {
  return createSystemUndeleteTransaction({
    ...commonData,
    ...data,
  });
};

const getAllData = (tx: SystemUndeleteTransaction): SystemUndeleteData => {
  return {
    ...getTransactionCommonData(tx),
    ...getSystemUndeleteData(tx),
  };
};

const handleDraftLoaded = (transaction: SystemUndeleteTransaction) => {
  handleUpdateData(getSystemUndeleteData(transaction));
};

const handleUpdateData = (newData: SystemUndeleteData) => {
  Object.assign(data, newData);
};

const preCreateAssert = () => {
  assertExactlyOneTarget();
};

/* Watchers */
</script>
<template>
  <BaseTransaction
    :transaction-ctor="SystemUndeleteTransaction"
    :create-transaction="createTransaction"
    :get-all-data="getAllData"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <SystemUndeleteFormData :data="data" @update:data="handleUpdateData" />
  </BaseTransaction>
</template>
