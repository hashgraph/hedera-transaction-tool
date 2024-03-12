<script setup lang="ts">
import { computed, ref } from 'vue';

import { Hbar } from '@hashgraph/sdk';

import useAccountId from '@renderer/composables/useAccountId';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppSwitch from '@renderer/components/ui/AppSwitch.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
withDefaults(
  defineProps<{
    accountLabel: string;
    showApproved?: boolean;
    showBalance?: boolean;
    spender?: string;
    buttonDisabled?: boolean;
  }>(),
  {
    showApproved: false,
    buttonDisabled: false,
  },
);

/* Emits */
const emit = defineEmits<{
  (event: 'handleAddTransfer', accountId: string, amount: Hbar, isApproved: boolean): void;
}>();

/* Composables */
const accountData = useAccountId();

/* State */
const amountRaw = ref('0');
const isApprovedTransfer = ref(false);

/* Computed */
const amount = computed(() => new Hbar(Number(amountRaw.value) || 0));

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
    'handleAddTransfer',
    accountData.accountIdFormatted.value,
    amount.value,
    isApprovedTransfer.value,
  );
};
</script>
<template>
  <div class="border rounded p-4">
    <form @submit="handleSubmit">
      <div class="form-group">
        <label class="form-label mb-0 me-3">{{ accountLabel }}</label>
        <label v-if="showBalance" class="form-label text-secondary"
          >Balance: {{ accountData.accountInfo.value?.balance }}</label
        >
        <AppInput
          :model-value="accountData.accountIdFormatted.value"
          @update:model-value="v => (accountData.accountId.value = v)"
          :filled="true"
          placeholder="Enter Account ID"
        />
      </div>
      <div class="form-group mt-4">
        <label class="form-label mb-0 me-3">Amount</label>
        <label v-if="spender && isApprovedTransfer" class="form-label text-secondary"
          >Allowance: {{ accountData.getSpenderAllowance(spender) }}</label
        >
        <AppInput v-model="amountRaw" type="number" :filled="true" placeholder="Enter Amount" />
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
    </form>
  </div>
</template>
