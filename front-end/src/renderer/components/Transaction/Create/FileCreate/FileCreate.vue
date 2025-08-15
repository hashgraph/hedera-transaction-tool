<script setup lang="ts">
import type { Prisma } from '@prisma/client';
import type { ExecutedSuccessData } from '@renderer/components/Transaction/TransactionProcessor';
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { FileCreateData } from '@renderer/utils/sdk';

import { computed, reactive, ref, watch } from 'vue';
import { Key, KeyList, Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useRoute } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import { add } from '@renderer/services/filesService';

import { isUserLoggedIn, createFileInfo, getEntityIdFromTransactionReceipt } from '@renderer/utils';
import {
  createFileCreateTransaction,
  createFileCreateDataOnlyTransaction,
  getFileCreateTransactionData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import FileCreateFormData from './FileCreateFormData.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const route = useRoute();
const toast = useToast();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<FileCreateData>({
  ownerKey: null,
  fileMemo: '',
  expirationTime: null,
  contents: '',
});
const fileName = ref('');
const description = ref('');

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createFileCreateTransaction({
      ...common,
      ...(data as FileCreateData),
    });
});

const createDisabled = computed(() => !data.ownerKey);

const transactionKey = computed(() => {
  const keys: Key[] = [];
  data.ownerKey && keys.push(data.ownerKey);
  return new KeyList(keys);
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
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
  toast.success(`File ${newFileId} linked`);
};

/* Functions */
const preCreateAssert = () => {
  if (!data.ownerKey) {
    throw Error('Key is required');
  }
};

/* Watchers */
watch(
  () => baseTransactionRef.value?.payerData.isValid.value,
  isValid => {
    const payer = baseTransactionRef.value?.payerData;
    if (isValid && payer?.key.value && !data.ownerKey && !route.query.draftId) {
      data.ownerKey = payer.key.value;
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
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    :transaction-base-key="transactionKey"
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
