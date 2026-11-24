<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FileId } from '@hiero-ledger/sdk';
import AppInput from '@renderer/components/ui/AppInput.vue';
import { InputStatus } from '@renderer/components/InputStatus.ts';
import { type InputReport } from '@renderer/components/InputReport.ts';

/* Models */
const fileId = defineModel<FileId | null>('fileId', { required: true });

/* Emits */
const emit = defineEmits<{
  (event: 'inputReport', report: InputReport<FileId>): void;
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

const inputReport = computed<InputReport<FileId>>(() => {
  let result: InputReport<FileId>;
  if (trimmedInputText.value === '') {
    result = { status: InputStatus.empty, value: null };
  } else {
    result =
      newFileId.value !== null
        ? { status: InputStatus.valid, value: newFileId.value }
        : { status: InputStatus.invalid, value: null };
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

watch(inputReport, () => emit('inputReport', inputReport.value), { immediate: true });
</script>

<template>
  <AppInput v-model:model-value="inputText" :filled="true" placeholder="Enter File ID" />
</template>

<style scoped></style>
