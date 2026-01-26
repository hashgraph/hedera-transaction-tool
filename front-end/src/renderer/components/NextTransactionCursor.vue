<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import AppButton from '@renderer/components/ui/AppButton.vue';
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';

/* Composables */
const router = useRouter();

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
  await nextTransaction.routeToPrev(router);
};

const handleNext = async () => {
  await nextTransaction.routeToNext(router);
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
  >
    <i class="bi bi-chevron-left"></i>
  </AppButton>
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
  >
    <i class="bi bi-chevron-right"></i>
  </AppButton>
</template>
