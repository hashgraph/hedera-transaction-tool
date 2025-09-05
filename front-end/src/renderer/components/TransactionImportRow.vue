<script setup lang="ts">
/* Props */
import { computed } from 'vue';
import type { TransactionSearchResult } from '@main/services/localUser';
import { getAllData, hexToUint8Array } from '@renderer/utils';
import { txTypeLabelMapping } from '@renderer/components/Transaction/Create/txTypeComponentMapping.ts';
import { Transaction } from '@hashgraph/sdk';

const props = defineProps<{
  transaction: TransactionSearchResult;
}>();

/* Computed */
const nickName = computed(() => basename(props.transaction.txFilePath));

const decodedTransaction = computed(() => {
  let result: Transaction | null;
  const bytes = hexToUint8Array(props.transaction.transactionBytes);
  try {
    result = Transaction.fromBytes(bytes);
  } catch (error) {
    console.log('error=' + error);
    result = null;
  }
  return result;
});

const transactionId = computed(() => {
  return decodedTransaction.value?.transactionId?.toString() ?? null;
});

const validStart = computed(() => {
  return decodedTransaction.value?.transactionId?.validStart?.toDate() ?? null;
});

const formattedValidStart = computed(() => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return validStart.value !== null ? dtf.format(validStart.value) : null
})

const allData = computed(() => {
  return decodedTransaction.value !== null ? getAllData(decodedTransaction.value) : null;
});

const transactionType = computed(() => {
  const txType = allData.value?.transactionType ?? null;
  return txType !== null ? txTypeLabelMapping[txType] : null;
});

const author = computed(() => {
  return props.transaction.transactionTxt?.Author ?? null;
});

const network = computed(() => {
  const nodeList = props.transaction.transactionCsva?.nodes.list ?? [];
  return nodeList.length >= 1 ? nodeList[0].network : null;
});

const status = computed(() => {
  let result: string | null;
  if (
    decodedTransaction.value === null ||
    transactionId.value === null ||
    validStart.value === null
  ) {
    result = 'Failed to decode transaction';
  } else if (props.transaction.transactionCsva === null) {
    result = 'Missing or invalid .csva file';
  } else if (props.transaction.transactionTxt === null) {
    result = 'Missing or invalid .txt file';
  } else {
    const dtf = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    const validSeconds = decodedTransaction.value.transactionValidDuration
    const expiryDate = validStart.value.getTime() + validSeconds * 1000;
    if (expiryDate < Date.now()) {
      result = 'Expired on ' + dtf.format(expiryDate);
    } else {
      result = null
    }
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
      <span v-if="transactionType"> - {{ transactionType }}</span>
    </strong>
    <p class="text-muted small">
      <template v-if="transactionId !== null">
        <span class="text-numeric">{{ transactionId }}</span> -
      </template>
      <template v-if="network !== null">
        <span>{{ network }}</span> -
      </template>
      <template v-if="formattedValidStart !== null">
        <span>Valid on {{ formattedValidStart }}</span> -
      </template>
      <template v-if="author !== null">
        <span>{{ author }}</span>
      </template>
    </p>
    <p class="text-muted small" v-if="status">
      <i class="bi bi-exclamation-triangle-fill"/>
      <span style="padding-inline: 6px">{{ status }}</span>
    </p>
  </div>
</template>

<style scoped></style>
