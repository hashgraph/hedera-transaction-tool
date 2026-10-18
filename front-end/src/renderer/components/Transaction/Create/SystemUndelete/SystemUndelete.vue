<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { SystemUndeleteData } from '@renderer/utils/sdk';

import { computed, reactive } from 'vue';
import { Transaction } from '@hiero-ledger/sdk';

import { isContractId, isFileId } from '@renderer/utils';
import { createSystemUndeleteTransaction, getSystemUndeleteData } from '@renderer/utils/sdk';

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
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createSystemUndeleteTransaction({
      ...common,
      ...data,
    });
});

const createDisabled = computed(() => {
  return !hasExactlyOneTarget();
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
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
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <SystemUndeleteFormData :data="data" @update:data="handleUpdateData" />
  </BaseTransaction>
</template>
