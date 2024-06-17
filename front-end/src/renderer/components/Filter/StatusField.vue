<script setup lang="ts">
import { computed } from 'vue';

import { ITransaction, TransactionStatus } from '@main/shared/interfaces';

import MultipleSelectFilterField from './MultipleSelectFilterField.vue';

/* Props */
const props = defineProps<{
  filter: {
    property: keyof ITransaction;
    rule: string;
    value: string | string[];
  } | null;
  inline?: boolean;
  history?: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:filter']);

/* Computed */
const selectedStatuses = computed(() => {
  if (!props.filter) return [];
  return Array.isArray(props.filter.value) ? props.filter.value : [props.filter.value];
});

/* Misc */
const allowedStatuses = [
  TransactionStatus.EXECUTED,
  TransactionStatus.EXPIRED,
  TransactionStatus.FAILED,
];
const statuses = Object.values(TransactionStatus)
  .filter(s => (props.history ? allowedStatuses.includes(s) : true))
  .map(status => ({
    value: status,
    label: status
      .toLocaleLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
  }));
</script>
<template>
  <MultipleSelectFilterField
    :filter="filter"
    @update:filter="emit('update:filter', $event)"
    :property="'status'"
    :label="'Status'"
    :items="statuses"
    :inline="inline"
  >
    <template #dropdown-toggler-content>
      <span class="flex-centered">
        <template v-if="inline"> <i class="bi bi-filter text-subheader me-1"></i>Status </template>
        <template v-else>
          {{ selectedStatuses.length > 0 ? 'Select Statuses' : 'All' }}
        </template>
      </span>
    </template>
  </MultipleSelectFilterField>
</template>
