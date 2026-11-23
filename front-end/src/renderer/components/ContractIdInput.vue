<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ContractId } from '@hiero-ledger/sdk';
import AppInput from '@renderer/components/ui/AppInput.vue';
import { InputStatus } from '@renderer/components/InputStatus.ts';

/* Models */
const contractId = defineModel<ContractId | null>('contractId', { required: true });

/* Emits */
const emit = defineEmits<{
  (event: 'inputStatus', status: InputStatus): void;
}>();

/* State */
const inputText = ref<string>('');

/* Computed */
const newContractId = computed<ContractId | null>(() => {
  let result: ContractId | null;
  try {
    result = ContractId.fromString(inputText.value.trim());
  } catch {
    result = null;
  }
  return result;
});

const inputStatus = computed<InputStatus>(() => {
  let result: InputStatus;
  if (inputText.value.trim() === '') {
    result = InputStatus.empty;
  } else {
    result = newContractId.value !== null ? InputStatus.valid : InputStatus.invalid;
  }
  return result;
});

/* Hooks */
watch(
  contractId,
  () => {
    inputText.value = contractId.value?.toString() ?? '';
  },
  { immediate: true },
);

watch(
  inputStatus,
  () => {
    emit('inputStatus', inputStatus.value);
  },
  { immediate: true },
);
</script>

<template>
  <AppInput v-model:model-value="inputText" :filled="true" placeholder="Enter Contract ID" />
</template>

<style scoped></style>
