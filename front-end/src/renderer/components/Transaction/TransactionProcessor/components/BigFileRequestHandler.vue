<script setup lang="ts">
import { ref } from 'vue';
import { Transaction, FileCreateTransaction } from '@hashgraph/sdk';

import { TRANSACTION_MAX_SIZE } from '@main/shared/constants';

// import useUserStore from '@renderer/stores/storeUser';

import { Handler, TransactionRequest } from '..';

/* Stores */
// const user = useUserStore();

/* State */
const nextHandler = ref<Handler | null>(null);

/* Set Next */
function setNext(next: Handler) {
  nextHandler.value = next;
}

/* Handle */
async function handle(request: TransactionRequest) {
  const transaction = Transaction.fromBytes(request.transactionBytes);

  const size = transaction.toBytes().length;
  const sizeBufferBytes = 200;

  if (
    !(transaction instanceof FileCreateTransaction) ||
    size <= TRANSACTION_MAX_SIZE - sizeBufferBytes
  ) {
    await nextHandler.value?.handle(request);
    return;
  }

  console.log('TO DO BIG FILE CREATE');
}

/* Expose */
defineExpose({
  handle,
  setNext,
});
</script>
<template>
  <div></div>
</template>
