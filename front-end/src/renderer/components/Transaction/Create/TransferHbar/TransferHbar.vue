<script setup lang="ts">
import type { IAccountInfoParsed } from '@shared/interfaces';

import { computed, reactive, ref, watch } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';
import { Hbar, TransferTransaction } from '@hiero-ledger/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { AppCache } from '@renderer/caches/AppCache';

import {
  createTransferHbarTransaction,
  getTransactionCommonData,
  getTransferHbarData,
  type TransactionCommonData,
  type TransferHbarData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import TransferHbarFormData from '@renderer/components/Transaction/Create/TransferHbar/TransferHbarFormData.vue';
import useUserStore from '@renderer/stores/storeUser.ts';

/* Stores */
const network = useNetworkStore();
const user = useUserStore();

/* Injected */
const accountByIdCache = AppCache.inject().mirrorAccountById;

/* State */
const baseTransactionRef = ref<ComponentExposed<typeof BaseTransaction> | null>(null);

const data = reactive<TransferHbarData>({
  transfers: [],
});
const accountInfos = ref<{
  [key: string]: IAccountInfoParsed;
}>({});

/* Computed */
const createDisabled = computed(() => {
  return (
    !totalBalance.value.toBigNumber().isEqualTo(0) ||
    totalBalanceAdjustments.value > 10 ||
    totalBalanceAdjustments.value === 0 ||
    (user.selectedOrganization === null && anyTransfersExceedingBalance.value)
  );
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

const anyTransfersExceedingBalance = computed(() => {
  let result = false;
  for (const transfer of data.transfers) {
    if (transfer.amount.isNegative()) {
      const accountInfo = accountInfos.value[transfer.accountId.toString()];
      if (
        accountInfo &&
        transfer.amount.negated().toBigNumber().isGreaterThan(accountInfo.balance.toBigNumber())
      ) {
        result = true;
        break;
      }
    }
  }
  return result;
});

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): TransferTransaction => {
  return createTransferHbarTransaction({
    ...commonData,
    ...(data as TransferHbarData),
  });
};

const getAllData = (tx: TransferTransaction): TransferHbarData => {
  return {
    ...getTransactionCommonData(tx),
    ...getTransferHbarData(tx),
  };
};

const handleDraftLoaded = async (transaction: TransferTransaction) => {
  handleUpdateData(getTransferHbarData(transaction));
  for (const accountId of data.transfers.map(t => t.accountId.toString())) {
    if (!accountInfos.value[accountId]) {
      const info = await accountByIdCache.lookup(accountId, network.mirrorNodeBaseURL);
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

/* Watchers */
watch(
  () => data,
  () => {
    baseTransactionRef.value?.updateTransactionKey();
  },
);
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="TransferTransaction"
    :create-transaction="createTransaction"
    :get-all-data="getAllData"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
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
