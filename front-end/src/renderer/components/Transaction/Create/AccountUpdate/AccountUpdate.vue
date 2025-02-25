<script setup lang="ts">
import type { IAccountInfoParsed } from '@main/shared/interfaces';
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { AccountUpdateData, AccountUpdateDataMultiple } from '@renderer/utils/sdk';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { AccountId, Key, KeyList, Transaction } from '@hashgraph/sdk';

import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { isAccountId } from '@renderer/utils';
import { createAccountUpdateTransaction, getAccountUpdateData } from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import AccountUpdateFormData from '@renderer/components/Transaction/Create/AccountUpdate/AccountUpdateFormData.vue';

/* Composables */
const route = useRoute();
const accountData = useAccountId();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);
const data = reactive<AccountUpdateData>({
  accountId: '',
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  stakeType: 'None',
  stakedAccountId: '',
  stakedNodeId: null,
  declineStakingReward: false,
  accountMemo: '',
  ownerKey: null,
});
const multipleAccountsData = ref<AccountUpdateDataMultiple | null>(null);

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createAccountUpdateTransaction(
      {
        ...common,
        ...(data as AccountUpdateData),
      },
      accountData.accountInfo.value as IAccountInfoParsed,
    );
});

const createDisabled = computed(() => {
  const noSingleAccount = !accountData.accountId.value || !accountData.isValid.value;
  const noMultipleAccounts =
    !multipleAccountsData.value ||
    multipleAccountsData.value?.accountIds.length === 0 ||
    multipleAccountsData.value?.key === null;

  return (
    (noSingleAccount && noMultipleAccounts) ||
    (data.stakeType === 'Account' && !isAccountId(data.stakedAccountId)) ||
    (data.stakeType === 'Node' && data.stakedNodeId === null)
  );
});

const transactionKey = computed(() => {
  const keys: Key[] = [];
  accountData.key.value && keys.push(accountData.key.value);
  data.ownerKey && keys.push(data.ownerKey);
  return new KeyList(keys);
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  handleUpdateData(getAccountUpdateData(transaction));
};

const handleUpdateData = (newData: AccountUpdateData) => {
  accountData.accountId.value = newData.accountId;
  Object.assign(data, newData);
};

/* Functions */
const preCreateAssert = () => {
  if (!isAccountId(accountData.accountId.value) || !accountData.key.value) {
    throw Error('Invalid Account ID');
  }
};

/* Hooks */
onMounted(() => {
  const accountId = route.query.accountId?.toString();
  if ((!route.query.draftId || isNaN(Number(route.query.groupIndex))) && accountId) {
    accountData.accountId.value = accountId;
    data.accountId = accountId;
  }
});

/* Watchers */
watch(
  () => data.stakedAccountId,
  id => {
    if (isAccountId(id) && id !== '0') {
      data.stakedAccountId = AccountId.fromString(id).toString();
    }
  },
);

watch(accountData.accountInfo, accountInfo => {
  if (!accountInfo) {
    data.receiverSignatureRequired = false;
    data.maxAutomaticTokenAssociations = 0;
    data.stakeType = 'None';
    data.stakedAccountId = '';
    data.stakedNodeId = null;
    data.declineStakingReward = false;
    data.accountMemo = '';
    data.ownerKey = null;
  } else if (!route.query.draftId) {
    data.receiverSignatureRequired = accountInfo.receiverSignatureRequired;
    data.maxAutomaticTokenAssociations = accountInfo.maxAutomaticTokenAssociations || 0;
    data.stakedAccountId = accountInfo.stakedAccountId?.toString() || '';
    data.stakedNodeId = accountInfo.stakedNodeId;
    data.stakeType = accountInfo.stakedAccountId
      ? 'Account'
      : accountInfo.stakedNodeId !== null
        ? 'Node'
        : 'None';
    data.declineStakingReward = accountInfo.declineReward;
    data.accountMemo = accountInfo.memo || '';
    data.ownerKey = accountInfo.key;
  }
});
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-base-key="transactionKey"
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
  >
    <AccountUpdateFormData
      v-model:multiple-accounts-data="multipleAccountsData"
      :data="data as AccountUpdateData"
      :account-info="accountData.accountInfo.value as IAccountInfoParsed"
      @update:data="handleUpdateData"
    />
  </BaseTransaction>
</template>
