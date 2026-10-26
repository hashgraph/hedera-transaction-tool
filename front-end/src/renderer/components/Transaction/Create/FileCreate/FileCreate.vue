<script setup lang="ts">
import type { Prisma } from '@prisma/client';
import type { ExecutedSuccessData } from '@renderer/components/Transaction/TransactionProcessor';

import { computed, reactive, ref, watch } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';
import { FileCreateTransaction } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRoute } from 'vue-router';
import { ToastManager } from '@renderer/utils/ToastManager';

import { add } from '@renderer/services/filesService';

import {
  createFileInfo,
  getEntityIdFromTransactionReceipt,
  getFileInfoTransactionData,
  getTransactionCommonData,
  isUserLoggedIn,
  type TransactionCommonData,
} from '@renderer/utils';
import {
  createFileCreateDataOnlyTransaction,
  createFileCreateTransaction,
  type FileCreateData,
  getFileCreateTransactionData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import FileCreateFormData from './FileCreateFormData.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const route = useRoute();
const toastManager = ToastManager.inject();

/* State */
const baseTransactionRef = ref<ComponentExposed<typeof BaseTransaction> | null>(null);

const data = reactive<FileCreateData>({
  ownerKey: null,
  fileMemo: '',
  expirationTime: null,
  contents: '',
});
const fileName = ref('');
const description = ref('');

/* Computed */
const createDisabled = computed(() => !data.ownerKey);

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): FileCreateTransaction => {
  return createFileCreateTransaction({
    ...commonData,
    ...data,
  });
};

const getAllData = (tx: FileCreateTransaction): FileCreateData => {
  return {
    ...getTransactionCommonData(tx),
    ...getFileInfoTransactionData(tx),
    ...getFileCreateTransactionData(tx),
  };
};

const handleDraftLoaded = (transaction: FileCreateTransaction) => {
  handleUpdateData(getFileCreateTransactionData(transaction));
};

const handleUpdateData = (newData: FileCreateData) => {
  Object.assign(data, newData);
};

const handleExecutedSuccess = async ({ receipt }: ExecutedSuccessData) => {
  if (!isUserLoggedIn(user.personal)) {
    return;
  }

  const newFileId = getEntityIdFromTransactionReceipt(receipt, 'fileId');

  const transaction = createFileCreateDataOnlyTransaction(data);
  const infoBytes = await createFileInfo({
    fileId: newFileId,
    size: transaction.contents?.length || 0,
    expirationTime: transaction.expirationTime,
    isDeleted: false,
    keys: transaction.keys || [],
    fileMemo: transaction.fileMemo || '',
    ledgerId: network.client.ledgerId,
  });

  const file: Prisma.HederaFileUncheckedCreateInput = {
    file_id: newFileId,
    user_id: user.personal.id,
    contentBytes: transaction.contents?.join(','),
    metaBytes: infoBytes.join(','),
    lastRefreshed: new Date(),
    nickname: fileName.value,
    description: description.value,
    network: network.network,
  };

  await add(file);
  toastManager.success(`File ${newFileId} linked`);
};

/* Functions */
const preCreateAssert = () => {
  if (!data.ownerKey) {
    throw Error('Key is required');
  }
};

/* Watchers */
watch(
  () => baseTransactionRef.value?.payerInfo.isValid,
  isValid => {
    const payer = baseTransactionRef.value?.payerInfo;
    if (isValid && payer?.key && !data.ownerKey && !route.query.draftId) {
      data.ownerKey = payer.key;
    }
  },
);
watch(
  () => [data.ownerKey],
  () => {
    baseTransactionRef.value?.updateTransactionKey();
  },
);
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="FileCreateTransaction"
    :create-transaction="createTransaction"
    :get-all-data="getAllData"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
    @executed:success="handleExecutedSuccess"
  >
    <FileCreateFormData
      :data="data as FileCreateData"
      @update:data="handleUpdateData"
      v-model:file-name="fileName"
      v-model:description="description"
    />
  </BaseTransaction>
</template>
