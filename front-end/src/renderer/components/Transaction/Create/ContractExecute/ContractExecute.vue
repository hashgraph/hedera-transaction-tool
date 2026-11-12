<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';

import { Hbar, ContractExecuteTransaction } from '@hiero-ledger/sdk';

import { getTransactionCommonData } from '@renderer/utils';
import {
  type ContractExecuteData,
  type TransactionCommonData,
  createContractExecuteTransaction,
  getContractExecuteData,
} from '@renderer/utils/sdk';
import { parseContractReference } from '@renderer/utils/sdk/contractCall';
import {
  areContractCallArgsEncodable,
  validateFunctionArgValue,
} from '@renderer/utils/sdk/contractFunctionParams';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import ContractExecuteFormData from '@renderer/components/Transaction/Create/ContractExecute/ContractExecuteFormData.vue';

/* State */
const baseTransactionRef = ref<ComponentExposed<typeof BaseTransaction> | null>(null);

const data = reactive<ContractExecuteData>({
  contractId: '',
  gas: 100000,
  payableAmount: new Hbar(0),
  functionName: '',
  functionArgs: [],
});

/* Computed */
const createDisabled = computed(() => {
  return (
    !parseContractReference(data.contractId) ||
    !data.functionName ||
    data.gas <= 0 ||
    !areContractCallArgsEncodable(data.functionArgs) ||
    // areContractCallArgsEncodable only catches what the SDK itself throws on (e.g. malformed
    // hex) - it doesn't range-check uint*/int*, so an out-of-range value would "encode"
    // successfully into a wrong/wrapped word without this.
    data.functionArgs.some(
      arg => arg.type !== 'bool' && validateFunctionArgValue(arg.type, arg.value) !== null,
    )
  );
});

const currentPayerId = computed(() => baseTransactionRef.value?.payerInfo.payerId || '');

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): ContractExecuteTransaction => {
  return createContractExecuteTransaction({
    ...commonData,
    ...data,
  } as TransactionCommonData & ContractExecuteData);
};

const getAllData = (tx: ContractExecuteTransaction): ContractExecuteData => {
  return {
    ...getTransactionCommonData(tx),
    ...getContractExecuteData(tx),
  };
};

const handleUpdateData = (newData: ContractExecuteData) => {
  Object.assign(data, newData);
};

// functionName/functionArgs can't be recovered without the originating ABI (see
// getContractExecuteData) - a reloaded draft restores contractId/gas/payableAmount but the
// user has to reselect the function and re-enter its arguments.
const handleDraftLoaded = (transaction: ContractExecuteTransaction) => {
  Object.assign(data, getContractExecuteData(transaction));
};
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="ContractExecuteTransaction"
    :create-transaction="createTransaction"
    :get-all-data="getAllData"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <template #default>
      <ContractExecuteFormData
        :data="data as ContractExecuteData"
        :payer-id="currentPayerId"
        @update:data="handleUpdateData"
      />
    </template>
  </BaseTransaction>
</template>
