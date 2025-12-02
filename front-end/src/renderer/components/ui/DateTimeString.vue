<script lang="ts" setup>
import { computed } from 'vue';
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';

/* Props */
const props = withDefaults(
  defineProps<{
    date: Date | null;
    compact?: boolean;
    wrap?: boolean;
  }>(),
  {
    date: null,
    compact: false,
    wrap: false,
  },
);

const dateOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
} as Intl.DateTimeFormatOptions;

const timeOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
} as Intl.DateTimeFormatOptions;

const extendedDateOptions = {
  ...dateOptions,
  weekday: 'short',
  month: 'short',
} as Intl.DateTimeFormatOptions;

const extendedTimeOptions = {
  ...timeOptions,
  timeZoneName: 'short',
} as Intl.DateTimeFormatOptions;

/* Composables */
const { isUtcSelected } = useDateTimeSetting();

/* Computed */
const datePart = computed(() => {
  let result: string;
  if (props.date) {
    const options = props.compact ? dateOptions : extendedDateOptions;
    const formatter = new Intl.DateTimeFormat(
      undefined,
      isUtcSelected.value ? { ...options, timeZone: 'UTC' } : options,
    );
    result = formatter.format(props.date);
  } else {
    result = '';
  }
  return result;
});

const timePart = computed(() => {
  let result: string;
  if (props.date) {
    const options = props.compact ? timeOptions : extendedTimeOptions;
    const formatter = new Intl.DateTimeFormat(
      undefined,
      isUtcSelected.value ? { ...options, timeZone: 'UTC' } : options,
    );
    result = formatter.format(props.date);
  } else {
    result = '';
  }
  return result;
});
</script>

<template>
  <span v-if="props.date" style="white-space: nowrap">
    <template v-if="props.wrap">
      {{ datePart }}<span>&nbsp;</span><wbr /><span class="text-body-tertiary">{{ timePart }}</span>
    </template>
    <template v-else>
      {{ datePart }}<span>&nbsp;</span><span class="text-body-tertiary">{{ timePart }}</span>
    </template>
  </span>
  <span v-else>-</span>
</template>
