<script setup lang="ts">
import MultipleSelectFilterFieldV2 from '@renderer/components/Filter/v2/MultipleSelectFilterFieldV2.vue';

export type PendingReviewFilterItem = 'PENDING_REVIEW';

/* Models */
const pendingReviewFilter = defineModel<PendingReviewFilterItem[]>('pendingReviewFilter', {
  required: true,
});

/* Misc */
const itemAndLabels: { item: PendingReviewFilterItem; label: string }[] = [
  { item: 'PENDING_REVIEW', label: 'Pending Review' },
];
</script>

<template>
  <MultipleSelectFilterFieldV2
    label="Filter"
    :item-and-labels="itemAndLabels"
    v-model:selected-items="pendingReviewFilter"
  />
</template>
