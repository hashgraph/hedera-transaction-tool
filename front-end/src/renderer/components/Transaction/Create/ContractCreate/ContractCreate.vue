<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';

import { Hbar, ContractCreateTransaction } from '@hiero-ledger/sdk';

import { getTransactionCommonData, isFileId } from '@renderer/utils';
import {
  type ContractCreateData,
  type TransactionCommonData,
  createContractCreateTransaction,
  getContractCreateData,
} from '@renderer/utils/sdk';
import { getMaxContractBytecodeSize } from '@renderer/utils/sdk/privilegedPayer';
import {
  areContractCallArgsEncodable,
  validateFunctionArgValue,
} from '@renderer/utils/sdk/contractFunctionParams';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import ContractCreateFormData from '@renderer/components/Transaction/Create/ContractCreate/ContractCreateFormData.vue';

/* State */
const baseTransactionRef = ref<ComponentExposed<typeof BaseTransaction> | null>(null);

const data = reactive<ContractCreateData>({
  bytecodeSource: 'inline',
  bytecodeHex: '',
  bytecodeFileId: '',
  adminKey: null,
  gas: 1000000,
  initialBalance: new Hbar(0),
  autoRenewAccountId: '',
  contractMemo: '',
  maxAutomaticTokenAssociations: 0,
  declineStakingReward: false,
  stakeType: 'None',
  stakedAccountId: '',
  stakedNodeId: null,
  constructorArgs: [],
});

// Temporary, remove once the dependency is bumped past hiero-sdk-js#4660 (see
// docs/contract-create-plan.md "Known upstream SDK gap"): a reloaded draft's inline bytecode
// cannot be recovered from the deserialized transaction, so the form must ask the user to
// re-upload it rather than silently proceeding with none set.
const needsBytecodeReupload = ref(false);

/* Computed */
const currentPayerId = computed(() => baseTransactionRef.value?.payerInfo.payerId || '');

const bytecodeByteLength = computed(() => Math.ceil(data.bytecodeHex.length / 2));
const isBytecodeOversized = computed(
  () =>
    data.bytecodeSource === 'inline' &&
    bytecodeByteLength.value > getMaxContractBytecodeSize(currentPayerId.value || null),
);

const createDisabled = computed(() => {
  const hasBytecode =
    data.bytecodeSource === 'file' ? isFileId(data.bytecodeFileId) : Boolean(data.bytecodeHex);

  return (
    !hasBytecode ||
    isBytecodeOversized.value ||
    data.gas <= 0 ||
    !areContractCallArgsEncodable(data.constructorArgs) ||
    // areContractCallArgsEncodable only catches what the SDK itself throws on (e.g. malformed
    // hex) - it doesn't range-check uint*/int*, so an out-of-range value would "encode"
    // successfully into a wrong/wrapped word without this.
    data.constructorArgs.some(
      arg => arg.type !== 'bool' && validateFunctionArgValue(arg.type, arg.value) !== null,
    )
  );
});

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): ContractCreateTransaction => {
  return createContractCreateTransaction({
    ...commonData,
    ...data,
  } as TransactionCommonData & ContractCreateData);
};

const getAllData = (tx: ContractCreateTransaction): ContractCreateData => {
  return {
    ...getTransactionCommonData(tx),
    ...getContractCreateData(tx),
  };
};

const handleUpdateData = (newData: ContractCreateData) => {
  Object.assign(data, newData);
};

// constructorArgs can't be recovered without the originating ABI (see getContractCreateData) - a
// reloaded draft restores everything else, but the user has to re-upload the ABI/bytecode
// artifact to get the constructor parameter fields (and, for inline bytecode, the bytecode
// itself - see needsBytecodeReupload) back.
const handleDraftLoaded = (transaction: ContractCreateTransaction) => {
  const restored = getContractCreateData(transaction);
  Object.assign(data, restored);
  needsBytecodeReupload.value = restored.bytecodeSource === 'inline' && !restored.bytecodeHex;
};
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="ContractCreateTransaction"
    :create-transaction="createTransaction"
    :get-all-data="getAllData"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <template #default>
      <ContractCreateFormData
        :data="data as ContractCreateData"
        :payer-id="currentPayerId"
        :needs-bytecode-reupload="needsBytecodeReupload"
        @update:data="handleUpdateData"
      />
    </template>
  </BaseTransaction>
</template>
