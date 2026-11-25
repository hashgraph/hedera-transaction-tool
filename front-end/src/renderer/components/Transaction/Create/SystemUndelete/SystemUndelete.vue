<script setup lang="ts">
import { computed, reactive } from 'vue';
import { SystemUndeleteTransaction } from '@hiero-ledger/sdk';

import { getTransactionCommonData, type TransactionCommonData } from '@renderer/utils';
import {
  createSystemUndeleteTransaction,
  getSystemUndeleteData,
  type SystemUndeleteData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import SystemUndeleteFormData from './SystemUndeleteFormData.vue';

/* State */
const data = reactive<SystemUndeleteData>({
  fileOrContractId: null,
});

/* Computed */
const createDisabled = computed(() => {
  return data.fileOrContractId === null;
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
  if (data.fileOrContractId === null) {
    throw new Error('File ID or Contract ID is required');
  }
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
