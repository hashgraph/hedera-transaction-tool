<script setup lang="ts">
import { BaseRequest, CustomRequest, TransactionRequest, type Handler, type Processable } from '..';

import { ref } from 'vue';
import { FileCreateTransaction, Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { assertUserLoggedIn, ableToSign, validateFileUpdateTransaction } from '@renderer/utils';
import { getTransactionType } from '@renderer/utils/sdk/transactions';
import { getMaxTransactionSizeForTransaction } from '@renderer/utils/sdk/privilegedPayer';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';

/* Constants */
const SIZE_BUFFER_BYTES = 200;

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Injected */
const accountByIdCache = AccountByIdCache.inject()

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

    request.name = request.name || '';
    request.description = request.description || '';
  } else {
    await validateCustomRequest(request);
  }

  if (nextHandler.value) {
    nextHandler.value.handle(request);
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

function validateSignableInPersonal(request: BaseRequest) {
  if (
    request.requestKey &&
    !ableToSign(user.publicKeys, request.requestKey) &&
    !user.selectedOrganization
  ) {
    throw new Error(
      'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
    );
  }
}

function validateBigFile(transaction: FileCreateTransaction) {
  const size = transaction.toBytes().length;
  // HIP-1300: privileged fee payers (0.0.2, 0.0.42-0.0.799) get a 128 KB limit.
  const maxSize = getMaxTransactionSizeForTransaction(transaction);

  if (size <= maxSize - SIZE_BUFFER_BYTES) {
    return;
  }

  if (user.selectedOrganization) {
    throw new Error(
      `${getTransactionType(transaction)} size exceeds max transaction size. It has to be split.`,
    );
  }
}

async function validateCustomRequest(request: CustomRequest) {
  await request.deriveRequestKey(network.mirrorNodeBaseURL, accountByIdCache);

  validateSignableInPersonal(request);
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
