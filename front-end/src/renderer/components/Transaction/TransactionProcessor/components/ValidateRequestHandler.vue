<script setup lang="ts">
import {
  MultipleAccountUpdateRequest,
  TransactionRequest,
  type Handler,
  type Processable,
} from '..';

import { ref } from 'vue';
import { FileCreateTransaction, Transaction } from '@hashgraph/sdk';

import { TRANSACTION_MAX_SIZE } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import {
  assertUserLoggedIn,
  ableToSign,
  getTransactionType,
  validateFileUpdateTransaction,
} from '@renderer/utils';

/* Constants */
const SIZE_BUFFER_BYTES = 200;

/* Stores */
const user = useUserStore();

/* State */
const nextHandler = ref<Handler | null>(null);

/* Actions */
function setNext(next: Handler) {
  nextHandler.value = next;
}

async function handle(request: Processable) {
  if (request instanceof TransactionRequest) {
    const transaction = Transaction.fromBytes(request.transactionBytes);
    if (!transaction) throw new Error('Transaction not provided');

    assertUserLoggedIn(user.personal);

    validate(request, transaction);

    if (nextHandler.value) {
      request.name = request.name || '';
      request.description = request.description || '';
      await nextHandler.value.handle(request);
    }
  } else if (request instanceof MultipleAccountUpdateRequest) {
    // TODO
  }
}

/* Functions */
function validate(request: TransactionRequest, transaction: Transaction) {
  validateSignableInPersonal(request);

  if (transaction instanceof FileCreateTransaction) {
    validateBigFile(transaction);
  }

  validateFileUpdateTransaction(transaction);

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

function validateBigFile(transaction: FileCreateTransaction) {
  const size = transaction.toBytes().length;

  if (size <= TRANSACTION_MAX_SIZE - SIZE_BUFFER_BYTES) {
    return;
  }

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
