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
  <div class="btn-group" role="group">
    <AppButton
      :disabled="!nextTransaction.hasPrev"
      class="btn-icon-only"
      color="secondary"
      data-testid="button-previous-org-transaction"
      type="button"
      @click="handlePrev"
    >
      <i class="bi bi-chevron-left"></i>
    </AppButton>
    <AppButton
      :disabled="true"
      color="secondary"
      class="text-numeric page-counter"
      type="button"
      >{{ positionLabel }}</AppButton
    >
    <AppButton
      :disabled="!nextTransaction.hasNext"
      class="btn-icon-only"
      color="secondary"
      data-testid="button-next-org-transaction"
      type="button"
      @click="handleNext"
    >
      <i class="bi bi-chevron-right"></i>
    </AppButton>
  </div>
</template>
<style scoped>
.page-counter {
  min-width: 80px;
  opacity: 0.8;
  padding-left: 8px;
  padding-right: 8px;
}
</style>
