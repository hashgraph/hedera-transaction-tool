<script setup lang="ts">
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import useAccountId from '../composables/useAccountId';

import AppInput from './ui/AppInput.vue';
import { onMounted } from 'vue';

/* Props */
defineProps<{
  payerId: string;
  validStart: string;
  maxTransactionFee: number;
}>();

/* Emits */
const emit = defineEmits(['update:payerId', 'update:validStart', 'update:maxTransactionFee']);

/* Stores */
const keyPairs = useKeyPairsStore();

/* Composables */
const account = useAccountId();

onMounted(() => {
  const allAccountIds = keyPairs.accoundIds.map(a => a.accountIds).flat();
  if (allAccountIds.length > 0) {
    account.accountId.value = allAccountIds[0];
    emit('update:payerId', allAccountIds[0]);
  }
});
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
