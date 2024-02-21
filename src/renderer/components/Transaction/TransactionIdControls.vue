<script setup lang="ts">
import { computed, onMounted } from 'vue';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';
import useUserStore from '@renderer/stores/storeUser';

import useAccountId from '@renderer/composables/useAccountId';

import AppInput from '@renderer/components/ui/AppInput.vue';

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
const user = useUserStore();

/* Computed */
const accoundIds = computed(() => keyPairs.accoundIds.map(a => a.accountIds).flat());

/* Composables */
const account = useAccountId();

/* Handlers */
const handlePayerChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  account.accountId.value = selectEl.value;
  emit('update:payerId', selectEl.value);
};

/* Hooks */
onMounted(() => {
  if (accoundIds.value.length > 0) {
    account.accountId.value = accoundIds.value[0];
    emit('update:payerId', accoundIds.value[0]);
  }
});

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <div class="row flex-wrap align-items-end">
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Payer ID <span class="text-danger">*</span></label>
      <label v-if="account.isValid.value" class="d-block form-label text-secondary"
        >Balance: {{ account.accountInfo.value?.balance || 0 }}</label
      >
      <template v-if="user.data.mode === 'personal'">
        <select class="form-select" :value="payerId" @change="handlePayerChange">
          <template v-for="accountId in accoundIds" :key="accountId">
            <option :value="accountId">{{ accountId }}</option>
          </template>
        </select>
      </template>
      <template v-else>
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
      </template>
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Valid Start Time</label>
      <AppInput
        :model-value="validStart"
        @update:model-value="v => $emit('update:validStart', v)"
        :filled="true"
        type="datetime-local"
        step="1"
      />
    </div>
    <div class="form-group" :class="[columnClass]">
      <label class="form-label">Max Transaction Fee</label>
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
