<script setup lang="ts">
import type { IAccountInfoParsed } from '@shared/interfaces';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';
import { AccountId, AccountUpdateTransaction } from '@hiero-ledger/sdk';

import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { isAccountId } from '@renderer/utils';
import {
  type AccountUpdateData,
  type AccountUpdateDataMultiple,
  createAccountUpdateTransaction,
  getAccountUpdateData,
  type TransactionCommonData,
} from '@renderer/utils/sdk';

import { MultipleAccountUpdateRequest } from '../../TransactionProcessor';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import AccountUpdateFormData from '@renderer/components/Transaction/Create/AccountUpdate/AccountUpdateFormData.vue';

/* Composables */
const route = useRoute();
const accountData = useAccountId();

/* State */
const baseTransactionRef = ref<ComponentExposed<typeof BaseTransaction> | null>(null);
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
// Single-account counterpart to AccountUpdateFormData's explicitKeySet:
// once the user has touched data.ownerKey for the current account, the
// accountInfo watcher below must stop overwriting it with the mirrored key
// whenever accountInfo re-fetches/re-emits.
const ownerKeyManuallySet = ref(false);

/* Computed */
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

const customRequest = computed(() => {
  if (!multipleAccountsData.value || !multipleAccountsData.value.key) {
    return;
  }
  return MultipleAccountUpdateRequest.fromAccountUpdateData(multipleAccountsData.value);
});

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): AccountUpdateTransaction => {
  return createAccountUpdateTransaction(
    {
      ...commonData,
      ...data,
    },
    accountData.accountInfo.value,
  );
};

const handleDraftLoaded = (transaction: AccountUpdateTransaction) => {
  handleUpdateData(getAccountUpdateData(transaction));
};

const handleUpdateData = (newData: AccountUpdateData) => {
  // Switching accounts should re-mirror the new account's key (reset the
  // flag); editing the key for the *same* account is the user overriding
  // the mirrored suggestion, so latch the flag so the accountInfo watcher
  // below leaves it alone from then on.
  if (newData.accountId !== data.accountId) {
    ownerKeyManuallySet.value = false;
  } else if (newData.ownerKey !== data.ownerKey) {
    ownerKeyManuallySet.value = true;
  }

  accountData.accountId.value = newData.accountId;
  Object.assign(data, newData);
};

/* Functions */
const preCreateAssert = () => {
  if (multipleAccountsData.value) {
    if (multipleAccountsData.value.accountIds.length === 0 || !multipleAccountsData.value.key) {
      throw Error('Invalid Account IDs');
    }
  } else {
    if (!isAccountId(accountData.accountId.value) || !accountData.key.value) {
      throw Error('Invalid Account ID');
    }
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
// Repopulates the form whenever the selected single account's info resolves
// (e.g. account id changes, or a fetch completes). Only applies to brand
// new drafts, so loading an existing draft/group entry isn't clobbered by
// the live-fetched account state.
watch(accountData.accountInfo, accountInfo => {
  const isBrandNewDraft =
    route.query.group === 'true' ? !route.query.groupIndex : !route.query.draftId;

  if (!accountInfo) {
    data.receiverSignatureRequired = false;
    data.maxAutomaticTokenAssociations = 0;
    data.stakeType = 'None';
    data.stakedAccountId = '';
    data.stakedNodeId = null;
    data.declineStakingReward = false;
    data.accountMemo = '';
    data.ownerKey = null;
    ownerKeyManuallySet.value = false;
  } else if (isBrandNewDraft) {
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
    // Only mirror the fetched key in as a default if the user hasn't
    // already made an explicit choice for this account (see handleUpdateData).
    if (!ownerKeyManuallySet.value) {
      data.ownerKey = accountInfo.key;
    }
  }
});
watch(
  () => [data.accountId, data.ownerKey],
  () => {
    baseTransactionRef.value?.updateTransactionKey();
  },
);
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="AccountUpdateTransaction"
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    :custom-request="customRequest"
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
