<script setup lang="ts">
import { computed } from 'vue';
import { Transaction, TransactionId } from '@hashgraph/sdk';
import { hexToUint8Array } from '@renderer/utils';
import type { V1ImportCandidate } from '@shared/interfaces';

/* Props */
const props = defineProps<{
  candidate: V1ImportCandidate;
}>();

/* Computed */
const nickName = computed(() => basename(props.candidate.filePath));

const transactionId = computed(() => {
  return props.candidate.transactionId;
});

const transaction = computed(() => {
  let result: Transaction | null;
  try {
    const bytes = hexToUint8Array(props.candidate.transactionBytes);
    result = Transaction.fromBytes(bytes);
  } catch (error) {
    console.log('error=' + error);
    result = null;
  }
  return result;
});

const validStart = computed(() => {
  let result: Date | null;
  if (transactionId.value !== null) {
    try {
      const tid = TransactionId.fromString(transactionId.value);
      result = tid.validStart?.toDate() ?? null;
    } catch {
      result = null;
    }
  } else {
    result = null;
  }
  return result;
});

const formattedValidStart = computed(() => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return validStart.value !== null ? dtf.format(validStart.value) : null;
});

const status = computed(() => {
  let result: string | null;
  if (transaction.value === null) {
    result = 'Failed to decode transaction';
  } else {
    result = null;
  }
  return result;
});

const signatureCount = computed(() => {
  let result: string;
  const count = Object.getOwnPropertyNames(props.candidate.nodeSignatures).length;
  switch (count) {
    case 0:
      result = 'No signature';
      break;
    case 1:
      result = 'One signature';
      break;
    default:
      result = count + ' signatures';
      break;
  }
  return result;
});

/* Function */

function basename(filePath: string): string {
  return filePath.substring(filePath.lastIndexOf('/') + 1);
}
</script>

<template>
  <div class="overflow-x-auto">
    <strong>
      <span>{{ transactionId }} - </span>
      <span>{{ signatureCount }} - </span>
      <span v-if="formattedValidStart !== null">Expires on {{ formattedValidStart }}</span>
    </strong>
    <p class="text-muted small">
      <span>{{ nickName }}</span>
    </p>
    <p class="text-muted small" v-if="status">
      <i class="bi bi-exclamation-triangle-fill" />
      <span style="padding-inline: 6px">{{ status }}</span>
    </p>
  </div>
</template>

<style scoped></style>
