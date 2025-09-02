<script setup lang="ts">
/* Props */
import { computed } from 'vue';
import type { TransactionSearchResult } from '@main/services/localUser';
import { hexToUint8Array } from '@renderer/utils';
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
    result = Transaction.fromBytes(bytes)
  } catch(error) {
    console.log("error=" + error)
    result = null;
  }
  return result;
});

const transactionId = computed(() => {
  return decodedTransaction.value?.transactionId?.toString() ?? null
});

const network = computed(() => {
  const nodeList = props.transaction.transactionCsva?.nodes.list ?? []
  return nodeList.length >= 1 ? nodeList[0].network : null
})

const validStart = computed(() => {
   return decodedTransaction.value?.transactionId?.validStart?.toDate() ?? null
});

const status = computed(() => {
  let result: string | null;
  if (decodedTransaction.value === null || transactionId.value === null || validStart.value === null) {
    result = 'Failed to decode transaction';
  } else if (props.transaction.transactionCsva === null) {
    result = '.csva file is missing or invalid';
  } else if (props.transaction.transactionTxt === null) {
    result = '.txt file is missing or invalid';
  } else {
    const dtf = new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "short",
    })
    const duration = 3000; // 3s
    const expiryDate = validStart.value.getTime() + duration;
    if (expiryDate < Date.now()) {
      result = "Expired on " + dtf.format(expiryDate)
    } else {
      result = "Valid start on " + dtf.format(validStart.value)
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
    <strong>{{ nickName }}</strong>
    <p class="text-muted small">
      <template v-if="transactionId !== null">
        <span class="text-numeric">{{ transactionId }}</span> -
      </template>
      <template v-if="network !== null">
        <span class="text-numeric">{{ network }}</span> -
      </template>
      <span>{{ status }}</span>
    </p>
  </div>
</template>

<style scoped></style>
