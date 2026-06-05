<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { InputStatus } from './InputStatus';

/* Props */
const value = defineModel<number | null>({ required: true });
const emit = defineEmits<{
  (e: 'status', value: InputStatus): void;
}>();

/* State */
const inputText = ref<string>('');

/* Computed */
const inputValue = computed<number | null>(() => {
  const trimmed = inputText.value.trim();
  const n = parseInt(trimmed);
  return isNaN(n) ? null : n;
});
const inputStatus = computed<InputStatus>(() => {
  let result: InputStatus;
  const trimmed = inputText.value.trim();
  if (trimmed.length === 0) {
    result = InputStatus.empty;
  } else if (inputValue.value !== null) {
    result = InputStatus.valid;
  } else {
    result = InputStatus.invalid;
  }
  return result;
});

/* Watchers */
watch(
  value,
  () => {
    if (value.value !== null) {
      inputText.value = value.value.toString();
    } else {
      inputText.value = '';
    }
  },
  { immediate: true },
);
watch(inputValue, () => {
  value.value = inputValue.value;
});
watch(
  inputStatus,
  (newStatus: InputStatus) => {
    emit('status', newStatus);
  },
  { immediate: true },
);
</script>

<template>
  <input v-model="inputText" placeholder="0-65535" class="form-control is-fill" />
</template>

<style scoped></style>
