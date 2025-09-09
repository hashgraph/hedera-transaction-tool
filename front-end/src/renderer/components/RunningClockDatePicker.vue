<script setup lang="ts">
import type { VueDatePickerProps } from '@vuepic/vue-datepicker';

import { onMounted, onUnmounted, ref } from 'vue';

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
  (event: 'userEdit'): void;
}>();

/* State */
const intervalId = ref<ReturnType<typeof setInterval> | null>(null);

/* Handlers */
const handleUpdateValue = (v: Date) => {
  emit('update:modelValue', v);
  emit('userEdit');
}

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
    :model-value="modelValue"
    @update:model-value="handleUpdateValue"
    :minDate="minDate"
    :maxDate="maxDate"
    :clearable="false"
    :placeholder="placeholder"
    :nowButtonVisible="nowButtonVisible"
    @open="stopInterval"
    @closed="startInterval"
  />
</template>
