<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';
import { FileAppendTransaction, Key } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';

import { isFileId, isLoggedInOrganization, type TransactionCommonData } from '@renderer/utils';
import {
  createFileAppendTransaction,
  type FileAppendData,
  getFileAppendTransactionData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import FileAppendFormData from './FileAppendFormData.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const route = useRoute();

/* State */
const baseTransactionRef = ref<ComponentExposed<typeof BaseTransaction> | null>(null);

/* Computed */
// HIP-1300: forward the currently selected fee payer to the form so the
// chunk-size input can grow to 128 KB for privileged accounts.
const currentPayerId = computed<string | null>(
  () => baseTransactionRef.value?.payerInfo.payerId ?? null,
);

const data = reactive<FileAppendData>({
  fileId: '',
  chunkSize: 4096,
  maxChunks: 9999999999999,
  contents: '',
});
const signatureKey = ref<Key | null>(null);

/* Computed */
const createDisabled = computed(
  () => (!isLoggedInOrganization(user.selectedOrganization) && !signatureKey.value) || !data.fileId,
);

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): FileAppendTransaction => {
  return createFileAppendTransaction({
    ...commonData,
    ...data,
  });
};

const handleDraftLoaded = (transaction: FileAppendTransaction) => {
  handleUpdateData(getFileAppendTransactionData(transaction));
};

const handleUpdateData = (newData: FileAppendData) => {
  Object.assign(data, newData);
};

/* Functions */
const preCreateAssert = () => {
  if (!isFileId(data.fileId)) {
    throw Error('Invalid File ID');
  }

  if (!signatureKey.value && !isLoggedInOrganization(user.selectedOrganization)) {
    throw Error('Signature key is required');
  }
};

/* Hooks */
onMounted(() => {
  if ((!route.query.draftId || isNaN(Number(route.query.groupIndex))) && route.query.fileId) {
    data.fileId = route.query.fileId.toString();
  }
});
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="FileAppendTransaction"
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <FileAppendFormData
      :data="data as FileAppendData"
      @update:data="handleUpdateData"
      :payer-id="currentPayerId"
      v-model:signature-key="signatureKey"
    />
  </BaseTransaction>
</template>
