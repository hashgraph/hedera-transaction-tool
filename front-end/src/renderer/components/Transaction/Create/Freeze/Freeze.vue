<script setup lang="ts">
import { computed, reactive } from 'vue';
import { FreezeTransaction } from '@hiero-ledger/sdk';

import {
  createFreezeTransaction,
  getFreezeData,
  type FreezeData,
  type TransactionCommonData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import FreezeFormData from '@renderer/components/Transaction/Create/Freeze/FreezeFormData.vue';
import { isAccountId } from '@renderer/utils';

/* State */
const data = reactive<FreezeData>({
  freezeType: -1,
  fileId: '',
  startTimestamp: new Date(),
  fileHash: '',
});

/* Computed */

// Start time is required if freeze type is FreezeOnly, FreezeUpgrade, or TelemetryUpgrade (not yet supported)
// FileId and FileHash are required if freeze type is PrepareUpgrade, FreezeUpgrade, or TelemetryUpgrade (not yet supported)
const createDisabled = computed(() => {
  const missingFileInfo =
    !isAccountId(data.fileId) || typeof data.fileHash !== 'string' || data.fileHash.trim() === '';

  const needsFileInfo = data.freezeType === 2 || data.freezeType === 3;
  const needsStartTimestamp = data.freezeType === 1 || data.freezeType === 3;

  return (
    data.freezeType === -1 ||
    (needsStartTimestamp && data.startTimestamp == null) ||
    (needsFileInfo && missingFileInfo)
  );
});

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): FreezeTransaction => {
  return createFreezeTransaction({
    ...commonData,
    ...data,
  });
};

const handleDraftLoaded = async (transaction: FreezeTransaction) => {
  handleUpdateData(getFreezeData(transaction));
};

const handleUpdateData = (newData: FreezeData) => {
  Object.assign(data, newData);
};
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="FreezeTransaction"
    :create-disabled="createDisabled"
    :create-transaction="createTransaction"
    @draft-loaded="handleDraftLoaded"
  >
    <FreezeFormData :data="data as FreezeData" @update:data="handleUpdateData" />
  </BaseTransaction>
</template>
