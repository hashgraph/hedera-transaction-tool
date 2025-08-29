<script setup lang="ts">
/* Props */
import { computed } from 'vue';
import type { TransactionMatch } from '@main/services/localUser';
import { decode } from 'msgpackr';
import { hexToUint8Array } from '@renderer/utils';

const props = defineProps<{
  transaction: TransactionMatch;
}>();

/* Computed */
const nickName = computed(() => basename(props.transaction.filePath));

const decodedTransaction = computed(() => {
  let result: unknown | null;
  const bytes = hexToUint8Array(props.transaction.transactionBytes);
  try {
    result = decode(bytes);
  } catch  {
    result = null;
  }
  return result;
});

const transactionId = computed(() => {
  return fetchString(decodedTransaction.value, "transactionId") ?? "?"
});

const transactionType = computed(() => {
  return fetchString(decodedTransaction.value, "type") ?? "?"
});

/* Function */
function basename(filePath: string): string {
  return filePath.substring(filePath.lastIndexOf('/') + 1);
}

function fetchString(obj: unknown, propertyName: string): string|null {
  let result: string|null
  if (propertyName in obj && typeof obj[propertyName] === 'string') {
    result = obj[propertyName]
  } else {
    result = null
  }
  return result
}

</script>

<template>
  <div class="overflow-x-auto">
    <strong>{{ nickName }}</strong>
    <p class="text-muted small">
      <span class="text-numeric">{{ transactionId }}</span> -
      <span>{{ transactionType}}</span>
    </p>
  </div>
</template>

<style scoped></style>
