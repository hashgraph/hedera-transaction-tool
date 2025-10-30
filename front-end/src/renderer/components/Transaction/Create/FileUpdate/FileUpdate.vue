<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { FileUpdateData } from '@renderer/utils/sdk';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Key, Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';

import { isLoggedInOrganization, isFileId } from '@renderer/utils';
import { createFileUpdateTransaction, getFileUpdateTransactionData } from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import FileUpdateFormData from './FileUpdateFormData.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const route = useRoute();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<FileUpdateData>({
  fileId: '',
  ownerKey: null,
  fileMemo: '',
  expirationTime: null,
  contents: '',
});
const signatureKey = ref<Key | null>(null);

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createFileUpdateTransaction({
      ...common,
      ...(data as FileUpdateData),
    });
});

const createDisabled = computed(
  () => (!isLoggedInOrganization(user.selectedOrganization) && !signatureKey.value) || !data.fileId,
);

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  handleUpdateData(getFileUpdateTransactionData(transaction));
};

const handleUpdateData = (newData: FileUpdateData) => {
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
