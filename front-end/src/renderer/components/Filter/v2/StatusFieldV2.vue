<script setup lang="ts">
import { TransactionStatus } from '@shared/interfaces';
import MultipleSelectFilterFieldV2 from '@renderer/components/Filter/v2/MultipleSelectFilterFieldV2.vue';

/* Models */
const statusFilter = defineModel<TransactionStatus[]>('statusFilter', { required: true });

/* Misc */
const itemAndLabels = Object.values(TransactionStatus).map(status => ({
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
