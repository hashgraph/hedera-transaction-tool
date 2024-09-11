<script setup lang="ts">
import type { DatePickerInstance, VueDatePickerProps } from '@vuepic/vue-datepicker';

import { onMounted, onUnmounted, ref } from 'vue';

import DatePicker from '@vuepic/vue-datepicker';
import AppButton from '@renderer/components/ui/AppButton.vue';

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
const datePicker = ref<DatePickerInstance>(null);
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

/* Hooks */
onMounted(async () => {
  startInterval();
});

onUnmounted(() => {
  stopInterval();
});
</script>
<template>
  <DatePicker
    ref="datePicker"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :clearable="false"
    :auto-apply="true"
    :config="{
      keepActionRow: true,
    }"
    :teleport="true"
    :ui="{
      calendar: 'is-fill',
      calendarCell: 'is-fill',
      menu: 'is-fill',
      input: 'is-fill',
    }"
    class="is-fill"
    enable-seconds
    @open="stopInterval"
    @closed="startInterval"
    v-bind="$attrs"
  >
    <template #action-row>
      <div class="d-flex justify-content-end gap-4 w-100">
        <AppButton
          v-if="nowButtonVisible"
          class="text-body min-w-unset"
          size="small"
          type="button"
          @click="$emit('update:modelValue', new Date())"
        >
          Now
        </AppButton>
        <AppButton
          class="min-w-unset"
          color="secondary"
          size="small"
          type="button"
          @click="datePicker?.closeMenu()"
          >Close</AppButton
        >
      </div>
    </template>
  </DatePicker>
</template>
