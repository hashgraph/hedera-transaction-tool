<script setup lang="ts">
import { computed } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';

/* Stores */
const nextTransaction = useNextTransactionV2();

/* Computed */
const positionLabel = computed(() => {
  let result: string;
  const collection = nextTransaction.currentCollection;
  if (collection !== null) {
    result = `${nextTransaction.currentIndex + 1}/${collection.length}`;
  } else {
    result = 'n/a';
  }
  return result;
});

/* Handlers */
const handlePrev = async () => {
  await nextTransaction.routeToPrev();
};

const handleNext = async () => {
  await nextTransaction.routeToNext();
};
</script>

<template>
  <AppButton
    type="button"
    color="secondary"
    class="btn-icon-only"
    :disabled="!nextTransaction.hasPrev"
    data-testid="button-prev"
    @click="handlePrev"
    >Prev</AppButton
  >
  <AppButton type="button" color="secondary" :disabled="true" style="min-width: 60px">{{
    positionLabel
  }}</AppButton>
  <AppButton
    type="button"
    color="secondary"
    class="btn-icon-only me-4"
    :disabled="!nextTransaction.hasNext"
    data-testid="button-next"
    @click="handleNext"
    >Next</AppButton
  >
</template>
