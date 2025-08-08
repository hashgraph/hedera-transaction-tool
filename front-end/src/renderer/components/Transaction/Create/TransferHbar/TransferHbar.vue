<script setup lang="ts">
import type { IAccountInfoParsed } from '@shared/interfaces';
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { TransferHbarData } from '@renderer/utils/sdk';

import { computed, reactive, ref } from 'vue';
import { Hbar, Key, KeyList, Transaction } from '@hashgraph/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { getAccountInfo } from '@renderer/services/mirrorNodeDataService';

import { createTransferHbarTransaction, getTransferHbarData } from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import TransferHbarFormData from '@renderer/components/Transaction/Create/TransferHbar/TransferHbarFormData.vue';

/* Stores */
const network = useNetworkStore();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<TransferHbarData>({
  transfers: [],
});
const accountInfos = ref<{
  [key: string]: IAccountInfoParsed;
}>({});

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createTransferHbarTransaction({
      ...common,
      ...(data as TransferHbarData),
    });
});

const createDisabled = computed(() => {
  return (
    !totalBalance.value.toBigNumber().isEqualTo(0) ||
    totalBalanceAdjustments.value > 10 ||
    totalBalanceAdjustments.value === 0
  );
});

const transactionKey = computed(() => {
  const keys: Key[] = [];
  const addedKeysForAccountIds: string[] = [];
  for (const transfer of data.transfers) {
    if (!transfer.isApproved) {
      const accountId = transfer.accountId.toString();

      const key = accountInfos.value[accountId]?.key;
      const receiverSigRequired = accountInfos.value[accountId]?.receiverSignatureRequired;

      if (
        key &&
        !addedKeysForAccountIds.includes(accountId) &&
        (transfer.amount.isNegative() || (!transfer.amount.isNegative() && receiverSigRequired))
      ) {
        keys.push(key);
        addedKeysForAccountIds.push(accountId);
      }
    }
  }
  return new KeyList(keys);
});

const totalBalance = computed(() => {
  const totalBalance = data.transfers.reduce(
    (acc, debit) => acc.plus(debit.amount.toBigNumber()),
    new Hbar(0).toBigNumber(),
  );
  return new Hbar(totalBalance);
});

const totalBalanceAdjustments = computed(
  () => [...new Set(data.transfers.map(t => t.accountId.toString()))].length,
);

/* Handlers */
const handleDraftLoaded = async (transaction: Transaction) => {
  handleUpdateData(getTransferHbarData(transaction));
  for (const accountId of data.transfers.map(t => t.accountId.toString())) {
    if (!accountInfos.value[accountId]) {
      const info = await getAccountInfo(accountId, network.mirrorNodeBaseURL);
      if (info) {
        accountInfos.value[accountId] = info;
      }
    }
  }
};

const handleUpdateData = (newData: TransferHbarData) => {
  Object.assign(data, newData);
};

/* Functions */
const preCreateAssert = () => {
  if (totalBalanceAdjustments.value > 10) {
    throw new Error('Total balance adjustments must not exceed 10');
  }

  if (totalBalanceAdjustments.value === 0) {
    throw new Error('Total balance adjustments must be greater than 0');
  }

  if (!totalBalance.value.toBigNumber().isEqualTo(0)) {
    throw new Error('The balance difference must be 0');
  }
};
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    :transaction-base-key="transactionKey"
    @draft-loaded="handleDraftLoaded"
  >
    <TransferHbarFormData
      :data="data as TransferHbarData"
      @update:data="handleUpdateData"
      v-model:account-infos="accountInfos"
      :total-balance="totalBalance"
      :total-balance-adjustments="totalBalanceAdjustments"
    />
  </BaseTransaction>
</template>
