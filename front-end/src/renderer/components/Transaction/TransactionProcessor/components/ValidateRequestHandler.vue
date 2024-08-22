<script setup lang="ts">
import { ref } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { ableToSign } from '@renderer/utils';
import { assertUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import { Handler, TransactionRequest } from '..';

/* Stores */
const user = useUserStore();

/* State */
const nextHandler = ref<Handler | null>(null);

/* Set Next */
function setNext(next: Handler) {
  nextHandler.value = next;
}

/* Handle */
function handle(request: TransactionRequest) {
  const transaction = Transaction.fromBytes(request.transactionBytes);

  if (!transaction) throw new Error('Transaction not provided');

  assertUserLoggedIn(user.personal);

  if (
    request.transactionKey &&
    !ableToSign(user.publicKeys, request.transactionKey) &&
    !user.selectedOrganization
  ) {
    throw new Error(
      'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
    );
  }

  if (nextHandler.value) {
    nextHandler.value.handle(request);
  }
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
