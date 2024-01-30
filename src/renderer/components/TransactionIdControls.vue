<script setup lang="ts">
// import { AccountId } from '@hashgraph/sdk';

import useAccountId from '../composables/useAccountId';

import AppInput from './ui/AppInput.vue';

/* Props */
defineProps<{
  payerId: string;
  validStart: string;
  maxTransactionFee: number;
}>();

/* Emits */
defineEmits(['update:payerId', 'update:validStart', 'update:maxTransactionFee']);

/* Composables */
const account = useAccountId();
</script>
<template>
  <div class="row flex-wrap align-items-end">
    <div class="form-group col-4 col-xxl-3">
      <label class="form-label">Set Payer ID (Required)</label>
      <label v-if="account.isValid.value" class="d-block form-label text-secondary"
        >Balance: {{ account.accountInfo.value?.balance || 0 }}</label
      >
      <AppInput
        :model-value="account.isValid.value ? account.accountIdFormatted.value : payerId"
        @update:model-value="
          v => {
            $emit('update:payerId', v);
            account.accountId.value = v;
          }
        "
        :filled="true"
        placeholder="Enter Payer ID"
      />
    </div>
    <div class="form-group col-4 col-xxl-3">
      <label class="form-label">Set Valid Start Time</label>
      <AppInput
        :model-value="validStart"
        @update:model-value="v => $emit('update:validStart', v)"
        :filled="true"
        type="datetime-local"
        step="1"
      />
    </div>
    <div class="form-group col-4 col-xxl-3">
      <label class="form-label">Set Max Transaction Fee</label>
      <AppInput
        :model-value="maxTransactionFee"
        @update:model-value="v => $emit('update:maxTransactionFee', Number(v))"
        :filled="true"
        type="number"
        min="0"
      />
    </div>
  </div>
</template>
