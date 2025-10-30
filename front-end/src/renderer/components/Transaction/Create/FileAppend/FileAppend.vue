<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { FileAppendData } from '@renderer/utils/sdk';

import { computed, onMounted, reactive, ref } from 'vue';
import { Key, Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';

import { isFileId, isLoggedInOrganization } from '@renderer/utils';
import { createFileAppendTransaction, getFileAppendTransactionData } from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import FileAppendFormData from './FileAppendFormData.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const route = useRoute();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<FileAppendData>({
  fileId: '',
  chunkSize: 4096,
  maxChunks: 9999999999999,
  contents: '',
});
const signatureKey = ref<Key | null>(null);

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createFileAppendTransaction({
      ...common,
      ...(data as FileAppendData),
    });
});

const createDisabled = computed(
  () => (!isLoggedInOrganization(user.selectedOrganization) && !signatureKey.value) || !data.fileId,
);

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
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
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <FileAppendFormData
      :data="data as FileAppendData"
      @update:data="handleUpdateData"
      v-model:signature-key="signatureKey"
    />
  </BaseTransaction>
</template>
