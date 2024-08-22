<script setup lang="ts">
import { ref } from 'vue';
import { FileCreateTransaction, Transaction } from '@hashgraph/sdk';

import { TRANSACTION_MAX_SIZE } from '@main/shared/constants';

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
async function handle(request: TransactionRequest) {
  const transaction = Transaction.fromBytes(request.transactionBytes);
  if (!transaction) throw new Error('Transaction not provided');

  assertUserLoggedIn(user.personal);

  validate(request, transaction);

  if (nextHandler.value) {
    await nextHandler.value.handle(request);
  }
}

/* Functions */
function validate(request: TransactionRequest, transaction: Transaction) {
  validateSignableInPersonal(request);

  if (transaction instanceof FileCreateTransaction) {
    validateFileCreate(transaction);
  }
}

function validateSignableInPersonal(request: TransactionRequest) {
  if (
    request.transactionKey &&
    !ableToSign(user.publicKeys, request.transactionKey) &&
    !user.selectedOrganization
  ) {
    throw new Error(
      'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
    );
  }
}

function validateFileCreate(transaction: FileCreateTransaction) {
  const size = transaction.toBytes().length;
  const bufferBytes = 200;

  if (size <= TRANSACTION_MAX_SIZE - bufferBytes) return;

  if (user.selectedOrganization) {
    throw new Error(
      'File Create transaction size exceeds max transaction size. It has to be split.',
    );
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
