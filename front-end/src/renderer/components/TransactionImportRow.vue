<script setup lang="ts">

/* Props */
import type { TransactionMatch } from '@main/services/localUser';

const props = defineProps<{
  transaction: TransactionMatch
}>();

/* Function */
function basename(filePath: string): string {
  return filePath.substring(filePath.lastIndexOf('/') + 1);
}

</script>

<template>
  <div class="overflow-x-auto">
    <strong>{{ basename(props.transaction.filePath) }}</strong>
    <p class="text-muted small">{{ props.transaction.transactionBytes.length }} bytes</p>
  </div>
</template>

<style scoped></style>
