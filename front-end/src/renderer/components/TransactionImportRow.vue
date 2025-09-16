<script setup lang="ts">
/* Props */
import { computed } from 'vue';
import type { TransactionSearchResult } from '@main/services/localUser';
import type { ITransactionFull } from '@shared/interfaces';
import { hexToUint8Array } from '@renderer/utils';
import { decode } from 'msgpackr';
import { TransactionId } from '@hashgraph/sdk';

const props = defineProps<{
  searchResult: TransactionSearchResult;
}>();

/* Computed */
const nickName = computed(() => basename(props.searchResult.tx2FilePath));

const decodedTransaction = computed(() => {
  let result: ITransactionFull | null;
  const bytes = hexToUint8Array(props.searchResult.tx2Bytes);
  try {
    result = decode(bytes);
  } catch (error) {
    console.log('error=' + error);
    result = null;
  }
  return result;
});

const transactionId = computed(() => {
  return decodedTransaction.value?.transactionId ?? null;
});

const validStart = computed(() => {
  let result: Date | null
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
  return result
});

const formattedValidStart = computed(() => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return validStart.value !== null ? dtf.format(validStart.value) : null
})

const transactionType = computed(() => {
  return decodedTransaction.value?.type ?? null;
});

const transactionStatus = computed(() => {
  return decodedTransaction.value?.status ?? null
})

const creatorEmail = computed(() => {
  return decodedTransaction.value?.creatorEmail ?? null
})

const status = computed(() => {
  let result: string | null;
  if (decodedTransaction.value === null || transactionId.value === null) {
    result = 'Failed to decode transaction';
  } else {
    result = null;
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
      <span>{{ nickName }}</span>
      <span v-if="transactionStatus"> - {{ transactionStatus }}</span>
    </strong>
    <p class="text-muted small">
      <span v-if="transactionType !== null">{{ transactionType }} - </span>
      <span v-if="formattedValidStart !== null">Valid on {{ formattedValidStart }} - </span>
      <span v-if="creatorEmail !== null">{{ creatorEmail }}</span>
    </p>
    <p class="text-muted small" v-if="status">
      <i class="bi bi-exclamation-triangle-fill" />
      <span style="padding-inline: 6px">{{ status }}</span>
    </p>
  </div>
</template>

<style scoped></style>
