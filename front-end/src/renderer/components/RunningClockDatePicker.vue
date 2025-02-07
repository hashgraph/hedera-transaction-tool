<script setup lang="ts">
import type { VueDatePickerProps } from '@vuepic/vue-datepicker';

import { onMounted, onUnmounted, ref, watch } from 'vue';

import AppDatePicker from '@renderer/components/ui/AppDatePicker.vue';

/* Props */
const props = defineProps<
  {
    modelValue: Date;
    nowButtonVisible?: boolean;
  } & VueDatePickerProps
>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: Date): void;
}>();

/* State */
const intervalId = ref<ReturnType<typeof setInterval> | null>(null);

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

function resetTime(date: Date) {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

function handleUpdateValidStart(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = new Date(date);
  selectedDate.setHours(0, 0, 0, 0);

  const isNewDate = selectedDate.getTime() !== today.getTime();

  if (isNewDate) {
    emit('update:modelValue', resetTime(date));
  } else {
    emit('update:modelValue', date);
  }
}

/* Hooks */
onMounted(async () => {
  startInterval();
});

onUnmounted(() => {
  stopInterval();
});

/* Watchers */
watch(
  () => props.modelValue,
  (newVal, oldVal) => {
    if (newVal.toDateString() !== oldVal.toDateString()) {
      emit('update:modelValue', resetTime(newVal));
    }
  },
);
</script>
<template>
  <AppDatePicker
    :model-value="modelValue"
    @update:model-value="handleUpdateValidStart"
    :minDate="minDate"
    :maxDate="maxDate"
    :clearable="false"
    :placeholder="placeholder"
    :nowButtonVisible="nowButtonVisible"
    @open="stopInterval"
    @closed="startInterval"
  />
</template>
