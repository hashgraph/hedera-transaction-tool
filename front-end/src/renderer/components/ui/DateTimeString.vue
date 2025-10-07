<script lang="ts" setup>
import useDateTimeSetting from '@renderer/composables/user/useDateTimeSetting.ts';
import { DateTimeOptions, getDateString, getDateStringExtended } from '@renderer/utils';
import { computed, onBeforeMount, ref } from 'vue';

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
const { getDateTimeSetting } = useDateTimeSetting();

/* State */
const dateTimeSetting = ref<DateTimeOptions>();

/* Computed */
const extendedDateString = computed(() => {
  return props.date ? getDateStringExtended(props.date, dateTimeSetting.value) : '';
});
const dateString = computed(() => {
  return props.date ? getDateString(props.date, dateTimeSetting.value) : '';
});

/* Hooks */
onBeforeMount(async () => {
  dateTimeSetting.value = await getDateTimeSetting();
});
</script>

<template>
    <span v-if="props.extended">{{ extendedDateString }}</span>
    <span v-else>{{ dateString }}</span>
</template>
