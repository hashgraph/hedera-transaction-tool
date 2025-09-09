<script setup lang="ts">
import type { CreateTransactionFunc } from '@renderer/components/Transaction/Create/BaseTransaction';
import type { ExecutedSuccessData } from '@renderer/components/Transaction/TransactionProcessor';
import type { AccountCreateData } from '@renderer/utils/sdk';

import { computed, nextTick, reactive, ref, watch } from 'vue';
import { AccountId, Hbar, Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';

import { add } from '@renderer/services/accountsService';

import { isAccountId, isUserLoggedIn, getEntityIdFromTransactionReceipt } from '@renderer/utils';
import { createAccountCreateTransaction, getAccountCreateData } from '@renderer/utils/sdk';

import BaseTransaction from '@renderer/components/Transaction/Create/BaseTransaction';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AccountCreateFormData from '@renderer/components/Transaction/Create/AccountCreate/AccountCreateFormData.vue';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const route = useRoute();

/* State */
const baseTransactionRef = ref<InstanceType<typeof BaseTransaction> | null>(null);

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

const gotUserEdit = ref(false)

/* Computed */
const createTransaction = computed<CreateTransactionFunc>(() => {
  return common =>
    createAccountCreateTransaction({
      ...common,
      ...(data as AccountCreateData),
    });
});

const createDisabled = computed(() => {
  return (
    !data.ownerKey ||
    (data.stakeType === 'Account' && !isAccountId(data.stakedAccountId)) ||
    (data.stakeType === 'Node' && data.stakedNodeId === null)
  );
});

/* Handlers */
const handleDraftLoaded = (transaction: Transaction) => {
  handleUpdateData(getAccountCreateData(transaction), false);
};

const handleUpdateData = (newData: AccountCreateData, userEdit = true) => {
  if (userEdit ) {
    gotUserEdit.value = true
  }
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
  toast.success(`Account ${accountId} linked`);
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
  () => baseTransactionRef.value?.payerData.isValid.value,
  isValid => {
    const payer = baseTransactionRef.value?.payerData;
    if (isValid && payer?.key.value && !data.ownerKey && !route.query.draftId) {
      data.ownerKey = payer.key.value;
    }
  },
);

watch(
  [() => data.initialBalance, () => baseTransactionRef.value?.payerData.accountInfo.value],
  async () => {
    const newBalance = data.initialBalance?.toBigNumber();
    const payerInfo = baseTransactionRef.value?.payerData.accountInfo.value;
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
    :create-transaction="createTransaction"
    :pre-create-assert="preCreateAssert"
    :create-disabled="createDisabled"
    :got-user-edit="gotUserEdit"
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
              @update:model-value="gotUserEdit = true"
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
