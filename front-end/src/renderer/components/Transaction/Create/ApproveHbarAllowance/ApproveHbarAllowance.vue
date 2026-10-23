<script setup lang="ts">
import type { IAccountInfoParsed } from '@shared/interfaces';

import { computed, reactive, ref, watch } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';
import { AccountAllowanceApproveTransaction, Hbar } from '@hiero-ledger/sdk';

import useAccountId from '@renderer/composables/useAccountId';

import { isAccountId } from '@renderer/utils';
import {
  type ApproveHbarAllowanceData,
  createApproveHbarAllowanceTransaction,
  getApproveHbarAllowanceTransactionData,
  type TransactionCommonData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import ApproveHbarAllowanceFormData from './ApproveHbarAllowanceFormData.vue';

/* Composables */
const ownerData = useAccountId();
const spenderData = useAccountId();

/* State */
const baseTransactionRef = ref<ComponentExposed<typeof BaseTransaction> | null>(null);

const data = reactive<ApproveHbarAllowanceData>({
  ownerAccountId: '',
  spenderAccountId: '',
  amount: Hbar.fromTinybars(0),
});

/* Computed */
const createDisabled = computed(() => !spenderData.key.value || !ownerData.key.value);

/* Handlers */
const createTransaction = (
  commonData: TransactionCommonData,
): AccountAllowanceApproveTransaction => {
  return createApproveHbarAllowanceTransaction({
    ...commonData,
    ...(data as ApproveHbarAllowanceData),
  });
};

const handleDraftLoaded = (transaction: AccountAllowanceApproveTransaction) => {
  handleUpdateData(getApproveHbarAllowanceTransactionData(transaction));
};

const handleUpdateData = (newData: ApproveHbarAllowanceData) => {
  Object.assign(data, newData);
  ownerData.accountId.value = newData.ownerAccountId;
  spenderData.accountId.value = newData.spenderAccountId;
};

/* Functions */
const preCreateAssert = () => {
  if (!isAccountId(ownerData.accountId.value) || !ownerData.key.value) {
    throw Error('Invalid Owner ID');
  }
  if (!isAccountId(spenderData.accountId.value)) {
    throw Error('Invalid Spender ID');
  }
};

/* Watchers */
watch(
  () => [data.ownerAccountId, data.spenderAccountId],
  () => {
    baseTransactionRef.value?.updateTransactionKey();
  },
);
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="AccountAllowanceApproveTransaction"
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <ApproveHbarAllowanceFormData
      :data="data as ApproveHbarAllowanceData"
      @update:data="handleUpdateData"
      :owner-info="ownerData.accountInfo.value as IAccountInfoParsed"
      :owner-allowances="ownerData.allowances.value"
      :spender-info="spenderData.accountInfo.value as IAccountInfoParsed"
    />
  </BaseTransaction>
</template>
