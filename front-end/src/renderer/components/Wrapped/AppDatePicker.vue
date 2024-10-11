<script setup lang="ts">
import type { DatePickerInstance, VueDatePickerProps } from '@vuepic/vue-datepicker';

import { ref } from 'vue';

import DatePicker from '@vuepic/vue-datepicker';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
defineProps<
  {
    modelValue: Date | undefined;
    nowButtonVisible?: boolean;
  } & VueDatePickerProps
>();

/* Emits */
defineEmits<{
  (event: 'update:modelValue', value: Date): void;
}>();

/* State */
const datePicker = ref<DatePickerInstance>(null);
</script>
<template>
  <DatePicker
    ref="datePicker"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :clearable="clearable"
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
    :placeholder="placeholder"
    :min-date="minDate"
    :max-date="maxDate"
    class="is-fill"
    enable-seconds
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
