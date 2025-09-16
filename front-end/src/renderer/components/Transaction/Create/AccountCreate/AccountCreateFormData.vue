<script setup lang="ts">
import type { AccountCreateData, AccountData } from '@renderer/utils/sdk';

import { Hbar, HbarUnit } from '@hashgraph/sdk';
import { onMounted, ref } from 'vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import AccountDataFormData from '@renderer/components/Transaction/Create/AccountData';

/* Props */
const props = defineProps<{
  data: AccountCreateData;
}>();

/* Emits */
const childLoaded = ref(false);
const selfMounted = ref(false);

const emit = defineEmits<{
  (event: 'update:data', data: AccountCreateData): void;
  (event: 'loaded'): void;
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
const handleAccountDataLoaded = () => {
  childLoaded.value = true;
  maybeEmitLoaded();
};

onMounted(() => {
  selfMounted.value = true;
  maybeEmitLoaded();
});

function maybeEmitLoaded() {
  if (childLoaded.value && selfMounted.value) {
    emit('loaded');
  }
}

</script>
<template>
  <AccountDataFormData
    :data="data"
    @update:data="handleAccountDataUpdate"
    @loaded="handleAccountDataLoaded"
  />

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
