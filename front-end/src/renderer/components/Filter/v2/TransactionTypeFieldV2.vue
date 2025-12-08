<script setup lang="ts">
import { BackEndTransactionType } from '@shared/interfaces';
import MultipleSelectFilterFieldV2 from '@renderer/components/Filter/v2/MultipleSelectFilterFieldV2.vue';

/* Models */
const transactionTypeFilter = defineModel<BackEndTransactionType[]>('transactionTypeFilter', {
  required: true,
});

/* Misc */
const itemAndLabels = Object.values(BackEndTransactionType).map(type => ({
  item: type,
  label: type
    .toLocaleLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '),
}));

/* Others */
</script>

<template>
  <MultipleSelectFilterFieldV2
    label="Transaction Type"
    :item-and-labels="itemAndLabels"
    v-model:selected-items="transactionTypeFilter"
  />
</template>
