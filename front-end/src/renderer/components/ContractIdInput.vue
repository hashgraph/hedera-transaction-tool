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
const trimmedInputText = computed(() => inputText.value.trim());

const newContractId = computed<ContractId | null>(() => {
  let result: ContractId | null;
  if (trimmedInputText.value === '') {
    result = null;
  } else {
    try {
      result = ContractId.fromString(trimmedInputText.value);
    } catch {
      result = null;
    }
  }
  return result;
});

const inputStatus = computed<InputStatus>(() => {
  let result: InputStatus;
  if (trimmedInputText.value === '') {
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
    if (contractId.value?.toString() !== newContractId.value?.toString()) {
      inputText.value = contractId.value?.toString() ?? '';
    }
  },
  { immediate: true },
);

watch(newContractId, () => {
  contractId.value = newContractId.value;
});

watch(inputStatus, () => emit('inputStatus', inputStatus.value), { immediate: true });
</script>

<template>
  <AppInput v-model:model-value="inputText" :filled="true" placeholder="Enter Contract ID" />
</template>

<style scoped></style>
