<script setup lang="ts">
import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import {
  createFileUpdateTransaction,
  type FileUpdateData,
  getFileUpdateTransactionData,
  type TransactionCommonData,
} from '@renderer/utils/sdk';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';
import { FileUpdateTransaction, Key } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';

import { isLoggedInOrganization } from '@renderer/utils';
import { useFileTransactionAssert } from '@renderer/composables/useFileTransactionAssert';
import FileUpdateFormData from './FileUpdateFormData.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const route = useRoute();

/* State */
const baseTransactionRef = ref<ComponentExposed<typeof BaseTransaction> | null>(null);

const data = reactive<FileUpdateData>({
  fileId: '',
  ownerKey: null,
  fileMemo: '',
  expirationTime: null,
  contents: '',
});
const signatureKey = ref<Key | null>(null);

/* Computed */
const createDisabled = computed(
  () => (!isLoggedInOrganization(user.selectedOrganization) && !signatureKey.value) || !data.fileId,
);

/* Handlers */
const handleDraftLoaded = (transaction: FileUpdateTransaction) => {
  handleUpdateData(getFileUpdateTransactionData(transaction));
};

const handleUpdateData = (newData: FileUpdateData) => {
  Object.assign(data, newData);
};

/* Functions */
const createTransaction = (commonData: TransactionCommonData): FileUpdateTransaction => {
  return createFileUpdateTransaction({
    ...commonData,
    ...data,
  });
};

const preCreateAssert = useFileTransactionAssert(data, signatureKey);

/* Hooks */
onMounted(() => {
  if ((!route.query.draftId || isNaN(Number(route.query.groupIndex))) && route.query.fileId) {
    data.fileId = route.query.fileId.toString();
  }
});

/* Watchers */
watch(
  () => [data.fileId, data.ownerKey],
  () => {
    baseTransactionRef.value?.updateTransactionKey();
  },
);
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="FileUpdateTransaction"
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <FileUpdateFormData
      :data="data as FileUpdateData"
      @update:data="handleUpdateData"
      v-model:signature-key="signatureKey"
    />
  </BaseTransaction>
</template>
