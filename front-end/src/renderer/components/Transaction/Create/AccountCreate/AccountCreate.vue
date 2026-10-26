<script setup lang="ts">
import type { ExecutedSuccessData } from '@renderer/components/Transaction/TransactionProcessor';

import { computed, nextTick, reactive, ref, watch } from 'vue';
import type { ComponentExposed } from 'vue-component-type-helpers';
import { AccountCreateTransaction, AccountId, Hbar } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { ToastManager } from '@renderer/utils/ToastManager';
import { useRoute } from 'vue-router';

import { add } from '@renderer/services/accountsService';

import {
  isAccountId,
  isUserLoggedIn,
  getEntityIdFromTransactionReceipt,
  getAccountData,
  getTransactionCommonData,
} from '@renderer/utils';
import {
  createAccountCreateTransaction,
  getAccountCreateData,
  type AccountCreateData,
  type TransactionCommonData,
} from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AccountCreateFormData from '@renderer/components/Transaction/Create/AccountCreate/AccountCreateFormData.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const route = useRoute();

/* Injected */
const toastManager = ToastManager.inject();

/* State */
const baseTransactionRef = ref<ComponentExposed<typeof BaseTransaction> | null>(null);

const data = reactive<AccountCreateData>({
  receiverSignatureRequired: false,
  maxAutomaticTokenAssociations: 0,
  stakeType: 'None',
  stakedAccountId: '',
  stakedNodeId: null,
  declineStakingReward: false,
  accountMemo: '',
  initialBalance: Hbar.fromString('0'),
  ownerKey: null,
});
const nickname = ref('');

/* Computed */
const createDisabled = computed(() => {
  return (
    !data.ownerKey ||
    (data.stakeType === 'Account' && !isAccountId(data.stakedAccountId)) ||
    (data.stakeType === 'Node' && data.stakedNodeId === null)
  );
});

/* Handlers */
const createTransaction = (commonData: TransactionCommonData): AccountCreateTransaction => {
  return createAccountCreateTransaction({
    ...commonData,
    ...(data as AccountCreateData),
  });
};

const getAllData = (tx: AccountCreateTransaction): AccountCreateData => {
  return {
    ...getTransactionCommonData(tx),
    ...getAccountData(tx),
    ...getAccountCreateData(tx),
  };
};

const handleDraftLoaded = (transaction: AccountCreateTransaction) => {
  handleUpdateData(getAccountCreateData(transaction));
};

const handleUpdateData = (newData: AccountCreateData) => {
  Object.assign(data, newData);
};

const handleExecutedSuccess = async ({ receipt }: ExecutedSuccessData) => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const accountId = getEntityIdFromTransactionReceipt(receipt, 'accountId');
  await add(user.personal.id, accountId, network.network, nickname.value);
  setTimeout(async () => {
    await user.refetchKeys();
    await user.refetchAccounts();
  }, 5000);
  toastManager.success(`Account ${accountId} has been linked`);
};

/* Functions */
const preCreateAssert = () => {
  if (!data.ownerKey) {
    throw new Error('Owner key is required');
  }
};

/* Watchers */
watch(
  () => data.stakedAccountId,
  id => {
    if (isAccountId(id) && id !== '0') {
      data.stakedAccountId = AccountId.fromString(id).toString();
    }
  },
);

watch(
  () => baseTransactionRef.value?.payerInfo.isValid,
  isValid => {
    const payer = baseTransactionRef.value?.payerInfo;
    if (isValid && payer?.key && !data.ownerKey && !route.query.draftId) {
      data.ownerKey = payer.key;
    }
  },
);

watch(
  [() => data.initialBalance, () => baseTransactionRef.value?.payerInfo.accountInfo],
  async () => {
    const newBalance = data.initialBalance?.toBigNumber();
    const payerInfo = baseTransactionRef.value?.payerInfo.accountInfo;
    const payerBalance = payerInfo?.balance?.toBigNumber();

    if (payerInfo && newBalance?.isGreaterThan(payerBalance || 0)) {
      await nextTick();
      data.initialBalance = new Hbar(0);
    }
  },
);
</script>
<template>
  <BaseTransaction
    ref="baseTransactionRef"
    :transaction-ctor="AccountCreateTransaction"
    :create-transaction="createTransaction"
    :get-all-data="getAllData"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @executed:success="handleExecutedSuccess"
    @draft-loaded="handleDraftLoaded"
  >
    <template #entity-nickname>
      <div v-if="!user.selectedOrganization" class="row mt-6">
        <div class="form-group col-4 col-xxxl-3">
          <label class="form-label">Nickname</label>
          <div>
            <AppInput
              v-model="nickname"
              :filled="true"
              data-testid="input-nickname"
              placeholder="Enter Account Nickname"
            />
          </div>
        </div>
      </div>
    </template>
    <template #default>
      <AccountCreateFormData :data="data as AccountCreateData" @update:data="handleUpdateData" />
    </template>
  </BaseTransaction>
</template>
