<script setup lang="ts">
import type { AccountCreateData, AccountData } from '@renderer/utils/sdk';

import { Hbar, HbarUnit } from '@hashgraph/sdk';

import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AccountDataFormData from '@renderer/components/Transaction/Create/AccountData';

/* Props */
const props = defineProps<{
  data: AccountCreateData;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:data', data: AccountCreateData): void;
}>();

/* Handlers */
const handleAccountDataUpdate = (data: AccountData) => {
  emit('update:data', {
    ...props.data,
    ...data,
  });
};

/* Misc */
const columnClass = 'col-4 col-xxxl-3';
</script>
<template>
  <AccountDataFormData :data="data" @update:data="handleAccountDataUpdate" />

  <div class="form-group mt-6" :class="[columnClass]">
    <label class="form-label">Initial Balance {{ HbarUnit.Hbar._symbol }}</label>
    <AppHbarInput
      data-testid="input-initial-balance-amount"
      :model-value="data.initialBalance as Hbar"
      @update:model-value="
        emit('update:data', {
          ...data,
          initialBalance: $event,
        })
      "
      placeholder="Enter Amount"
      :filled="true"
    />
  </div>
</template>
