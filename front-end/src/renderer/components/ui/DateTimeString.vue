<script lang="ts" setup>
import { computed } from 'vue';
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';
import { formatDatePart, formatTimePart } from '@renderer/utils/dateTimeFormat.ts';

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

/* Composables */
const { isUtcSelected } = useDateTimeSetting();

/* Computed */
const datePart = computed(() => {
  let result: string;
  if (props.date) {
    result = formatDatePart(props.date, isUtcSelected.value, props.compact);
  } else {
    result = '';
  }
  return result;
});

const timePart = computed(() => {
  let result: string;
  if (props.date) {
    result = formatTimePart(props.date, isUtcSelected.value, props.compact);
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
