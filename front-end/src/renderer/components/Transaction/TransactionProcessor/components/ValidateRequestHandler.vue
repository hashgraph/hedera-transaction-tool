<script setup lang="ts">
import { ref } from 'vue';
import { FileCreateTransaction, FileUpdateTransaction, Transaction } from '@hashgraph/sdk';

import { TRANSACTION_MAX_SIZE } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { ableToSign, getTransactionType } from '@renderer/utils';
import { assertUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import { Handler, TransactionRequest } from '..';

/* Stores */
const user = useUserStore();

/* State */
const nextHandler = ref<Handler | null>(null);

/* Actions */
function setNext(next: Handler) {
  nextHandler.value = next;
}

async function handle(request: TransactionRequest) {
  const transaction = Transaction.fromBytes(request.transactionBytes);
  if (!transaction) throw new Error('Transaction not provided');

  assertUserLoggedIn(user.personal);

  validate(request, transaction);

  if (nextHandler.value) {
    await nextHandler.value.handle({
      ...request,
      name: request.name || '',
      description: request.description || '',
    });
  }
}

/* Functions */
function validate(request: TransactionRequest, transaction: Transaction) {
  validateSignableInPersonal(request);

  if (
    transaction instanceof FileCreateTransaction ||
    transaction instanceof FileUpdateTransaction
  ) {
    validateBigFile(transaction);
  }

  if (request.name && request.name?.length > 50) {
    throw new Error('Transaction name is too long');
  }

  if (request.description && request.description?.length > 256) {
    throw new Error('Transaction description is too long');
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

function validateBigFile(transaction: FileCreateTransaction | FileUpdateTransaction) {
  const size = transaction.toBytes().length;
  const sizeBufferBytes = 200;

  if (size <= TRANSACTION_MAX_SIZE - sizeBufferBytes) return;

  if (user.selectedOrganization) {
    throw new Error(
      `${getTransactionType(transaction)} size exceeds max transaction size. It has to be split.`,
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
