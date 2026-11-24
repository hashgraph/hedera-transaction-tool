<script setup lang="ts">
import { computed, reactive } from 'vue';
import { SystemDeleteTransaction } from '@hiero-ledger/sdk';

import { getTransactionCommonData, type TransactionCommonData } from '@renderer/utils';
import {
  createSystemDeleteTransaction,
  getSystemDeleteData,
  type SystemDeleteData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import SystemDeleteFormData from './SystemDeleteFormData.vue';

/* State */
const data = reactive<SystemDeleteData>({
  fileOrContractId: null,
  expirationTime: null,
});

/* Computed */
const createDisabled = computed(() => {
  return data.fileOrContractId === null || data.expirationTime === null;
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
  if (data.fileOrContractId === null) {
    throw new Error('File ID or Contract ID is required');
  }

  if (data.expirationTime === null) {
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
