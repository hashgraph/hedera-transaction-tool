<script setup lang="ts">
import { computed, watch } from 'vue';

import AppSelect from '@renderer/components/ui/AppSelect.vue';

/* Props */
const { eventDate } = defineProps<{
  eventDate?: Date;
}>();

/* Model */
const model = defineModel<number | null>(); // in milliseconds

/* Computed */
const allOptions = computed(() => {
  const optionsLabel = [
    '5 minutes before',
    '10 minutes before',
    '15 minutes before',
    '30 minutes before',
    '1 hour before',
    '2 hours before',
    '1 day before',
    '2 days before',
    '1 week before',
  ];

  const ONE_MINUTE = 60 * 1_000;
  const optionsValues = [
    ONE_MINUTE * 5,
    ONE_MINUTE * 10,
    ONE_MINUTE * 15,
    ONE_MINUTE * 30,
    ONE_MINUTE * 60,
    ONE_MINUTE * 120,
    ONE_MINUTE * 60 * 24,
    ONE_MINUTE * 60 * 24 * 2,
    ONE_MINUTE * 60 * 24 * 7,
  ];

  return optionsLabel.map((label, index) => ({
    label,
    value: optionsValues[index],
  }));
});

const visibleOptions = computed(() => {
  if (!eventDate) {
    return allOptions.value;
  }

  const now = new Date();
  const diff = eventDate.getTime() - now.getTime();

  return allOptions.value.filter(option => option.value < diff);
});

/* Watchers */
watch(visibleOptions, () => {
  if (model.value && !visibleOptions.value.find(option => option.value === model.value)) {
    model.value = null;
  }
});
</script>
<template>
  <AppSelect
    :color="'secondary'"
    toggle-text="Remind"
    toggler-icon
    v-model:value="model"
    :items="visibleOptions"
  />
</template>
