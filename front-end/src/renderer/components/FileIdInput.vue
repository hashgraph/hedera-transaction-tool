<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FileId } from '@hiero-ledger/sdk';
import AppInput from '@renderer/components/ui/AppInput.vue';
import { InputStatus } from '@renderer/components/InputStatus.ts';

/* Models */
const fileId = defineModel<FileId | null>('fileId', { required: true });

/* Emits */
const emit = defineEmits<{
  (event: 'inputStatus', status: InputStatus): void;
}>();

/* State */
const inputText = ref<string>('');

/* Computed */
const trimmedInputText = computed(() => inputText.value.trim());

const newFileId = computed<FileId | null>(() => {
  let result: FileId | null;
  if (trimmedInputText.value === '') {
    result = null;
  } else {
    try {
      result = FileId.fromString(trimmedInputText.value);
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
    result = newFileId.value !== null ? InputStatus.valid : InputStatus.invalid;
  }
  return result;
});

/* Hooks */
watch(
  fileId,
  () => {
    if (fileId.value?.toString() !== newFileId.value?.toString()) {
      inputText.value = fileId.value?.toString() ?? '';
    }
  },
  { immediate: true },
);

watch(newFileId, () => {
  fileId.value = newFileId.value;
});

watch(inputStatus, () => emit('inputStatus', inputStatus.value), { immediate: true });
</script>

<template>
  <AppInput v-model:model-value="inputText" :filled="true" placeholder="Enter File ID" />
</template>

<style scoped></style>
