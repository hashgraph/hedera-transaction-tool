<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { FreezeData } from '@renderer/utils/sdk';

import { computed, reactive, ref } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import { createFreezeTransaction, getFreezeData } from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import FreezeFormData from '@renderer/components/Transaction/Create/Freeze/FreezeFormData.vue';

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<FreezeData>({
  freezeType: -1,
  fileId: '',
  startTimestamp: new Date(),
  fileHash: '',
});

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createFreezeTransaction({
      ...common,
      ...(data as FreezeData),
    });
});

/* Handlers */
const handleDraftLoaded = async (transaction: Transaction) => {
  handleUpdateData(await getFreezeData(transaction));
};

const handleUpdateData = (newData: FreezeData) => {
  Object.assign(data, newData);
};
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :create-transaction="createTransaction"
    @draft-loaded="handleDraftLoaded"
  >
    <FreezeFormData :data="data as FreezeData" @update:data="handleUpdateData" />
  </BaseTransaction>
</template>
