<script setup lang="ts">
import type { DatePickerInstance, VueDatePickerProps } from '@vuepic/vue-datepicker';

import { computed, ref } from 'vue';

import DatePicker from '@vuepic/vue-datepicker';
import AppButton from '@renderer/components/ui/AppButton.vue';
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';

/* Props */
const props = defineProps<
  {
    modelValue: Date | undefined;
    nowButtonVisible?: boolean;
  } & VueDatePickerProps
>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: Date): void;
  (event: 'open'): void;
  (event: 'close'): void;
}>();

/* Composables */
const { isUtcSelected } = useDateTimeSetting();

/* State */
const datePicker = ref<DatePickerInstance>(null);

/* Computed */
const inputValue = computed(() => {
  let result: string | Date | undefined;
  if (props.modelValue) {
    result = isUtcSelected.value ? new Date(props.modelValue.toUTCString()) : props.modelValue;
  } else {
    result = undefined;
  }
  return result;
});

/* Handlers */
function handleNow() {
  emit('update:modelValue', new Date());
  datePicker.value?.closeMenu();
}

function handleUpdate(value: string | Date) {
  if (typeof value === 'string') {
    emit('update:modelValue', new Date(value));
  } else {
    emit('update:modelValue', value);
  }
}
</script>
<template>
  <DatePicker
    ref="datePicker"
    :model-value="inputValue"
    :utc="isUtcSelected ? 'preserve' : undefined"
    :clearable="clearable"
    auto-apply
    partial-flow
    text-input
    :config="{
      keepActionRow: true,
    }"
    :ui="{
      calendar: 'is-fill',
      calendarCell: 'is-fill',
      menu: 'is-fill',
      input: 'is-fill',
    }"
    :placeholder="placeholder"
    :min-date="minDate"
    :max-date="maxDate"
    teleport="body"
    class="is-fill"
    enable-seconds
    @open="$emit('open')"
    @close="$emit('close')"
    @update:model-value="handleUpdate"
  >
    <template #action-row>
      <div class="d-flex justify-content-end gap-4 w-100">
        <AppButton
          v-if="props.nowButtonVisible"
          class="text-body min-w-unset"
          size="small"
          type="button"
          @click="handleNow"
        >
          Now
        </AppButton>
        <AppButton
          class="min-w-unset"
          color="secondary"
          size="small"
          type="button"
          @click="datePicker?.closeMenu()"
        >
          Close
        </AppButton>
      </div>
    </template>
  </DatePicker>
</template>
