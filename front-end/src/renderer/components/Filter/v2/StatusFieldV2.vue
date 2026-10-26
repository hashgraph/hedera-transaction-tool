<script setup lang="ts">
import { TransactionStatus } from '@shared/interfaces';
import MultipleSelectFilterFieldV2 from '@renderer/components/Filter/v2/MultipleSelectFilterFieldV2.vue';

/* Models */
const statusFilter = defineModel<TransactionStatus[]>('statusFilter', { required: true });

/* Misc */
// This field is only used in the History tab, which can only ever return transactions in a
// terminal state (see TRANSACTION_STATUS_COLLECTIONS.HISTORY on the back-end).
const allowedStatuses = [
  TransactionStatus.EXECUTED,
  TransactionStatus.EXPIRED,
  TransactionStatus.FAILED,
  TransactionStatus.CANCELED,
  TransactionStatus.ARCHIVED,
];

const itemAndLabels = allowedStatuses.map(status => ({
  item: status,
  label: status
    .toLocaleLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '),
}));
</script>

<template>
  <MultipleSelectFilterFieldV2
    label="Status"
    :item-and-labels="itemAndLabels"
    v-model:selected-items="statusFilter"
  />
</template>
