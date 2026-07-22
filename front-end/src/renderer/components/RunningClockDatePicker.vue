<script setup lang="ts">
import type { DateValue } from '@vuepic/vue-datepicker';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import AppDatePicker from '@renderer/components/ui/AppDatePicker.vue';

/* Props */
const props = defineProps<{
  modelValue: Date;
  nowButtonVisible?: boolean;
  minDate?: DateValue;
  maxDate?: DateValue;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: Date): void;
}>();

/* State */
const intervalId = ref<ReturnType<typeof setInterval> | null>(null);
const isMenuOpen = ref(false);
const pendingValue = ref<Date | null>(null);

/* Computed */
// While the menu is open, show the user's in-progress edits without
// committing them upstream. Otherwise mirror the upstream value.
const displayValue = computed(() => pendingValue.value ?? props.modelValue);

/* Functions */
function startInterval() {
  intervalId.value = setInterval(() => {
    const now = new Date();
    if (props.modelValue < now) {
      emit('update:modelValue', now);
    }
  }, 1000);
}

function stopInterval() {
  intervalId.value && clearInterval(intervalId.value);
}

function handleUpdate(value: Date) {
  if (isMenuOpen.value) {
    pendingValue.value = value;
  } else {
    emit('update:modelValue', value);
  }
}

function handleOpen() {
  stopInterval();
  pendingValue.value = null;
  isMenuOpen.value = true;
}

function handleClosed() {
  isMenuOpen.value = false;
  if (
    pendingValue.value !== null &&
    pendingValue.value.getTime() !== props.modelValue.getTime()
  ) {
    emit('update:modelValue', pendingValue.value);
  }
  pendingValue.value = null;
  startInterval();
}

/* Hooks */
onMounted(async () => {
  startInterval();
});

onUnmounted(() => {
  stopInterval();
});
</script>
<template>
  <AppDatePicker
    :model-value="displayValue"
    @update:model-value="handleUpdate"
    :minDate="minDate"
    :maxDate="maxDate"
    :clearable="false"
    :nowButtonVisible="nowButtonVisible"
    @open="handleOpen"
    @closed="handleClosed"
  />
</template>
