<script setup lang="ts">
import type { ITransaction } from '@shared/interfaces';

import { TransactionStatus } from '@shared/interfaces';

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

/* Misc */
const allowedStatuses = [
  TransactionStatus.EXECUTED,
  TransactionStatus.EXPIRED,
  TransactionStatus.FAILED,
  TransactionStatus.CANCELED,
  TransactionStatus.ARCHIVED,
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

const label = 'Status';
</script>
<template>
  <MultipleSelectFilterField
    :filter="filter"
    @update:filter="emit('update:filter', $event)"
    :property="'status'"
    :label="label"
    :items="statuses"
    :inline="inline"
  />
</template>
