<script setup lang="ts">
import type { IAccountInfoParsed } from '@shared/interfaces';
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { AccountDeleteData } from '@renderer/utils/sdk';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';
import useAccountId from '@renderer/composables/useAccountId';

import { remove } from '@renderer/services/accountsService';

import { isAccountId, isUserLoggedIn, safeAwait } from '@renderer/utils';
import { createAccountDeleteTransaction, getAccountDeleteData } from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import AccountDeleteFormData from '@renderer/components/Transaction/Create/AccountDelete/AccountDeleteFormData.vue';
import AccountDeleteConfirmModal from '@renderer/components/Transaction/Create/AccountDelete/AccountDeleteConfirmModal.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const route = useRoute();
const accountData = useAccountId();
const transferAccountData = useAccountId();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

const data = reactive<AccountDeleteData>({
  accountId: '',
  transferAccountId: '',
});
const isConfirmModalShown = ref(false);
const isConfirmed = ref(false);

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createAccountDeleteTransaction({
      ...common,
      ...(data as AccountDeleteData),
    });
});

const createDisabled = computed(() => {
  return (
    !accountData.isValid.value ||
    !transferAccountData.isValid.value ||
    accountData.accountInfo.value?.deleted ||
    transferAccountData.accountInfo.value?.deleted
  );
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  handleUpdateData(getAccountDeleteData(transaction));
};

const handleUpdateData = (newData: AccountDeleteData) => {
  accountData.accountId.value = newData.accountId;
  transferAccountData.accountId.value = newData.transferAccountId;
  Object.assign(data, newData);
};

const handleConfirm = async (confirm: boolean) => {
  isConfirmed.value = confirm;
  confirm && (await baseTransactionRef.value?.submit());
};

const handleExecuted = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  await safeAwait(remove(user.personal.id, [accountData.accountId.value]));

  setTimeout(async () => {
    await user.refetchKeys();
    await user.refetchAccounts();
  }, 5000); /* Counter mirror node delay */
};

/* Functions */
const preCreateAssert = () => {
  if (!isAccountId(accountData.accountId.value) || !accountData.key.value) {
    throw Error('Invalid Account ID');
  }
  if (!isAccountId(transferAccountData.accountId.value) || !transferAccountData.key.value) {
    throw Error('Invalid Transfer Account ID');
  }

  if (!isConfirmed.value) {
    isConfirmModalShown.value = true;
    return false;
  }
};

/* Hooks */
onMounted(async () => {
  const accountId = route.query.accountId?.toString();
  if ((!route.query.draftId || isNaN(Number(route.query.groupIndex))) && accountId) {
    accountData.accountId.value = accountId;
    data.accountId = accountId;
  }
});

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
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    @draft-loaded="handleDraftLoaded"
    @executed:success="handleExecuted"
  >
    <template #default>
      <AccountDeleteFormData
        :data="data as AccountDeleteData"
        @update:data="handleUpdateData"
        :account-info="accountData.accountInfo.value as IAccountInfoParsed"
        :transfer-account-info="transferAccountData.accountInfo.value as IAccountInfoParsed"
      />

      <AccountDeleteConfirmModal
        v-model:show="isConfirmModalShown"
        :account-id="accountData.accountIdFormatted.value"
        @confirm="handleConfirm"
      />
    </template>
  </BaseTransaction>
</template>
