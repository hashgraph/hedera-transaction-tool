<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ContractId } from '@hiero-ledger/sdk';
import AppInput from '@renderer/components/ui/AppInput.vue';
import { type InputReport, InputStatus } from '@renderer/components/InputReport.ts';

/* Models */
const contractId = defineModel<ContractId | null>('contractId', { required: true });

/* Emits */
const emit = defineEmits<{
  (event: 'inputReport', status: InputReport<ContractId>): void;
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

const inputReport = computed<InputReport<ContractId>>(() => {
  let result: InputReport<ContractId>;
  if (trimmedInputText.value === '') {
    result = { status: InputStatus.empty, value: null };
  } else {
    result =
      newContractId.value !== null
        ? { status: InputStatus.valid, value: newContractId.value }
        : { status: InputStatus.invalid, value: null };
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

watch(inputReport, () => emit('inputReport', inputReport.value), { immediate: true });
</script>

<template>
  <AppInput v-model:model-value="inputText" :filled="true" placeholder="Enter Contract ID" />
</template>

<style scoped></style>
