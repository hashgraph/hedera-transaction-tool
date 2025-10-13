<script lang="ts" setup>
import { computed } from 'vue';
import { getDateString, getDateStringExtended } from '@renderer/utils';
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';

/* Props */
const props = withDefaults(
  defineProps<{
    date: Date | null;
    extended?: boolean;
  }>(),
  {
    date: null,
    extended: true,
  },
);

/* Composables */
const { isUtcSelected } = useDateTimeSetting();

/* Computed */
const extendedDateString = computed(() => {
  return props.date ? getDateStringExtended(props.date, isUtcSelected.value) : '';
});
const dateString = computed(() => {
  return props.date ? getDateString(props.date, isUtcSelected.value) : '';
});
</script>

<template>
  <span v-if="props.extended">{{ extendedDateString }}</span>
  <span v-else>{{ dateString }}</span>
</template>
