<script setup lang="ts">
import { isValidFqdn, VALID_IPV4_REGEX } from '@renderer/utils/endpointUtils';
import { computed, ref, watch } from 'vue';
import { InputStatus } from './InputStatus';

/* Props */
const value = defineModel<string | Uint8Array | null>({ required: true });
const emit = defineEmits<{
  (e: 'status', value: InputStatus): void;
}>();

/* State */
const inputText = ref<string>('');

/* Computed */
const inputValue = computed<string | Uint8Array | null>(() => {
  let result: string | Uint8Array | null;

  const trimmed = inputText.value.trim();
  if (isValidFqdn(trimmed)) {
    result = trimmed;
  } else if (trimmed.match(VALID_IPV4_REGEX)) {
    result = Uint8Array.from(trimmed.split('.').map(Number));
  } else {
    result = null;
  }
  return result;
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
    if (value.value instanceof Uint8Array) {
      inputText.value = value.value.join('.');
    } else if (typeof value.value === 'string') {
      inputText.value = value.value;
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
  <input
    v-model="inputText"
    placeholder="Enter Domain Name or IP Address"
    class="form-control is-fill"
  />
</template>

<style scoped></style>
