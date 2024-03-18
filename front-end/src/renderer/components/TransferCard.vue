<script setup lang="ts">
import { ref } from 'vue';

import { Hbar, HbarUnit } from '@hashgraph/sdk';

import useAccountId from '@renderer/composables/useAccountId';

import { stringifyHbar } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';

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

/* Composables */
const accountData = useAccountId();

/* State */
const amount = ref<Hbar>(new Hbar(0));
const isApprovedTransfer = ref(false);

/* Handlers */
const handleSubmit = (e: Event) => {
  e.preventDefault();

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
</script>
<template>
  <div class="border rounded overflow-hidden p-4">
    <form @submit="handleSubmit">
      <div class="form-group overflow-hidden">
        <label class="form-label mb-0 me-3">{{ accountLabel }}</label>
        <label
          v-if="showBalanceInLabel && accountData.isValid.value"
          class="form-label text-secondary"
          >Balance:
          {{
            stringifyHbar((accountData.accountInfo.value?.balance as Hbar) || new Hbar(0))
          }}</label
        >
        <AppInput
          :model-value="accountData.accountIdFormatted.value"
          @update:model-value="v => (accountData.accountId.value = v)"
          :filled="true"
          placeholder="Enter Account ID"
        />
      </div>
      <div class="form-group mt-4">
        <label class="form-label mb-0 me-3">Amount {{ HbarUnit.Hbar._symbol }}</label>
        <label v-if="spender?.trim() && isApprovedTransfer" class="form-label text-secondary"
          >Allowance: {{ stringifyHbar(accountData.getSpenderAllowance(spender)) }}</label
        >
        <!-- @vue-ignore Broken type inference -->
        <AppHbarInput v-model:model-value="amount" placeholder="Enter Amount" :filled="true" />
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
              >Add Rest</AppButton
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
            ><span class="bi bi-plus-lg"></span> Add Transfer</AppButton
          >
        </div>
      </div>
    </form>
  </div>
</template>
