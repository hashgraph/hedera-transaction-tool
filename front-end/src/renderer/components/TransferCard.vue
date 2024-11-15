<script setup lang="ts">
import type { HederaAccount } from '@prisma/client';

import { nextTick, onBeforeMount, ref, watch } from 'vue';

import { Hbar, HbarUnit } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import useAccountId from '@renderer/composables/useAccountId';

import { getAll } from '@renderer/services/accountsService';

import { stringifyHbar, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AccountIdInput from '@renderer/components/AccountIdInput.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    accountLabel: string;
    showApproved?: boolean;
    showBalanceInLabel?: boolean;
    showTransferRest?: boolean;
    spender?: string;
    clearOnAddTransfer?: boolean;
    buttonDisabled?: boolean;
    addRestDisabled?: boolean;
    restrictAmountToBalance?: boolean;
    dataTestIdAccountIdInput?: string;
    dataTestIdHbarInput?: string;
    dataTestIdAddRest?: string;
    dataTestIdAddTransfer?: string;
  }>(),
  {
    showApproved: false,
    buttonDisabled: false,
  },
);

/* Emits */
const emit = defineEmits<{
  (event: 'transferAdded', accountId: string, amount: Hbar, isApproved: boolean): void;
  (event: 'restAdded', accountId: string, isApproved: boolean): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const accountData = useAccountId();

/* State */
const amount = ref<Hbar>(new Hbar(0));
const isApprovedTransfer = ref(false);
const accoundIds = ref<HederaAccount[]>([]);

/* Handlers */
const handleSubmit = () => {
  if (!accountData.isValid.value) {
    throw new Error('Invalid Account ID');
  }

  if (amount.value.isNegative() || amount.value.toBigNumber().isEqualTo(0)) {
    throw new Error('Amount must be greater than zero');
  }

  emit(
    'transferAdded',
    accountData.accountIdFormatted.value,
    amount.value as Hbar,
    isApprovedTransfer.value,
  );

  if (props.clearOnAddTransfer) {
    clearData();
  }
};

const handleAddRest = () => {
  if (!accountData.isValid.value) {
    throw new Error('Invalid Account ID');
  }

  emit('restAdded', accountData.accountIdFormatted.value, isApprovedTransfer.value);

  if (props.clearOnAddTransfer) {
    clearData();
  }
};

/* Functions */
function clearData() {
  accountData.accountId.value = '';
  amount.value = new Hbar(0);
  isApprovedTransfer.value = false;
}

/* Hooks */
onBeforeMount(async () => {
  if (isUserLoggedIn(user.personal)) {
    accoundIds.value = await getAll({
      where: {
        user_id: user.personal.id,
        network: network.network,
      },
    });
  }
});

/* Watchers */
watch([amount, accountData.isValid], async ([newAmount]) => {
  if (
    props.restrictAmountToBalance &&
    accountData.isValid.value &&
    accountData.accountInfo.value?.balance.toBigNumber().isLessThan(newAmount.toBigNumber())
  ) {
    await nextTick();
    amount.value = accountData.accountInfo.value?.balance as Hbar;
  }
});
</script>
<template>
  <div class="border rounded overflow-hidden p-4">
    <form @submit.prevent="handleSubmit">
      <div class="form-group overflow-hidden position-relative">
        <label class="form-label me-3">{{ accountLabel }}</label>
        <label v-if="accountData.accountInfo.value?.deleted" class="form-label text-danger me-3"
          ><span class="bi bi-exclamation-triangle-fill me-1"></span> Account is deleted</label
        >
        <label
          v-else-if="showBalanceInLabel && accountData.isValid.value"
          class="form-label text-secondary"
          >Balance:
          {{
            stringifyHbar((accountData.accountInfo.value?.balance as Hbar) || new Hbar(0))
          }}</label
        >

        <AccountIdInput
          :model-value="accountData.accountId.value"
          @update:model-value="accountData.accountId.value = $event"
          :filled="true"
          :items="accoundIds.map(a => a.account_id).concat(user.publicKeysToAccountsFlattened)"
          placeholder="Enter Account ID"
          :data-testid="dataTestIdAccountIdInput"
        />
      </div>
      <div class="form-group mt-4">
        <label class="form-label me-3">Amount {{ HbarUnit.Hbar._symbol }}</label>
        <label v-if="spender?.trim() && isApprovedTransfer" class="form-label text-secondary"
          >Allowance: {{ stringifyHbar(accountData.getSpenderAllowance(spender)) }}</label
        >
        <AppHbarInput
          v-model:model-value="amount as Hbar"
          placeholder="Enter Amount"
          :filled="true"
          :data-testid="dataTestIdHbarInput"
        />
      </div>
      <div class="d-flex align-items-center justify-content-end flex-wrap gap-4 mt-4">
        <template v-if="showApproved">
          <div class="flex-1">
            <AppSwitch
              v-model:checked="isApprovedTransfer"
              :size="'md'"
              :label="'Approve Transfer'"
              class="mb-0 text-nowrap text-main"
              name="approve-transfer"
            ></AppSwitch>
          </div>
        </template>
        <div class="d-flex flex-wrap gap-4">
          <template v-if="showTransferRest">
            <AppButton
              type="button"
              color="secondary"
              @click="handleAddRest"
              :disabled="!accountData.isValid.value || addRestDisabled"
              :data-testid="dataTestIdAddRest"
              >Add All</AppButton
            >
          </template>
          <AppButton
            color="primary"
            :disabled="
              !accountData.isValid.value ||
              amount.isNegative() ||
              amount.toBigNumber().isEqualTo(0) ||
              buttonDisabled
            "
            :data-testid="dataTestIdAddTransfer"
            ><span class="bi bi-plus-lg"></span> Add Transfer</AppButton
          >
        </div>
      </div>
    </form>
  </div>
</template>
