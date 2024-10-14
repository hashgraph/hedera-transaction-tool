<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';
import type { Handler, TransactionRequest } from '..';

import { computed, ref } from 'vue';
import { Transaction, FileUpdateTransaction, FileAppendTransaction } from '@hashgraph/sdk';

import { TRANSACTION_MAX_SIZE } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { createTransactionId } from '@renderer/services/transactionService';

import OrganizationRequestHandler from './OrganizationRequestHandler.vue';

import { assertHandlerExists } from '..';
import { isLoggedInOrganization } from '@renderer/utils/userStoreHelpers';

/* Constants */
const FIRST_CHUNK_SIZE_BYTES = 100;

/* Props */
defineProps<{
  observers: number[];
  approvers: TransactionApproverDto[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transaction:submit:success', id: number, body: string): void;
  (event: 'transaction:submit:fail', error: unknown): void;
}>();

/* Stores */
const user = useUserStore();

/* State */
const organizationHandler = ref<InstanceType<typeof OrganizationRequestHandler> | null>(null);
const nextHandler = ref<Handler | null>(null);

const request = ref<TransactionRequest | null>(null);
const appendProcessed = ref<boolean>(false);

/* Computed */
const originalTransaction = computed(() =>
  request.value ? Transaction.fromBytes(request.value.transactionBytes) : null,
);
const content = computed(() => {
  if (!originalTransaction.value) return null;
  if (!isFileUpdate(originalTransaction.value)) return null;
  return originalTransaction.value.contents;
});

/* Actions */
function setNext(next: Handler) {
  nextHandler.value = next;
}

async function handle(req: TransactionRequest) {
  const transaction = Transaction.fromBytes(req.transactionBytes);
  const size = transaction.toBytes().length;
  const sizeBufferBytes = 200;

  if (
    !isLoggedInOrganization(user.selectedOrganization) ||
    !isFileUpdate(transaction) ||
    size <= TRANSACTION_MAX_SIZE - sizeBufferBytes ||
    !transaction.contents
  ) {
    await nextHandler.value?.handle(req);
    return;
  }

  reset();
  request.value = req;

  await processAppend();
}

/* Handlers */
const handleSubmitSuccess = async (id: number, transactionBytes: string) => {
  if (!appendProcessed.value) {
    appendProcessed.value = true;
    await processUpdate();
  } else {
    emit('transaction:submit:success', id, transactionBytes);
  }
};

const handleSubmitFail = (error: unknown) => emit('transaction:submit:fail', error);

/* Functions */
async function startChain(req: TransactionRequest) {
  assertHandlerExists<typeof OrganizationRequestHandler>(organizationHandler.value, 'Organization');
  await organizationHandler.value.handle(req);
}

async function processUpdate() {
  if (!request.value) throw new Error('Transaction request is missing');

  const transaction = Transaction.fromBytes(request.value.transactionBytes);
  assertTransactionType(transaction);
  if (!content.value) throw new Error('Transaction content is missing');

  transaction.setContents(content.value.slice(0, FIRST_CHUNK_SIZE_BYTES));

  await startChain({
    transactionBytes: transaction.toBytes(),
    transactionKey: request.value.transactionKey,
    name: request.value.name,
    description: request.value.description,
  });
}

async function processAppend() {
  if (!request.value) throw new Error('Transaction request is missing');

  const transaction = createAppendTransaction();

  await startChain({
    transactionBytes: transaction.toBytes(),
    transactionKey: request.value.transactionKey,
    name: request.value.name,
    description: request.value.description,
  });
}

function createAppendTransaction() {
  if (!originalTransaction.value) throw new Error('Transaction is missing');
  if (!isFileUpdate(originalTransaction.value))
    throw new Error('Transaction is not a File Update Transaction');
  if (!content.value) throw new Error('Transaction content is missing');

  const originalTransactionId = originalTransaction.value.transactionId;
  if (!originalTransactionId) throw new Error('Original transaction ID is missing');
  if (!originalTransactionId.accountId) throw new Error('Transaction payer ID is missing');
  if (!originalTransactionId.validStart) throw new Error('Transaction valid start is missing');

  const fileId = originalTransaction.value.fileId;
  if (!fileId) throw new Error('File ID is missing');

  const append = new FileAppendTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(originalTransaction.value.maxTransactionFee)
    .setTransactionId(
      createTransactionId(
        originalTransactionId.accountId,
        originalTransactionId.validStart.plusNanos(10),
      ),
    )
    .setFileId(fileId)
    .setContents(content.value.slice(FIRST_CHUNK_SIZE_BYTES))
    .setMaxChunks(99999);

  return append;
}

function isFileUpdate(transaction: Transaction): transaction is FileUpdateTransaction {
  return transaction instanceof FileUpdateTransaction;
}

function assertTransactionType(
  transaction: Transaction,
): asserts transaction is FileUpdateTransaction {
  if (!isFileUpdate(transaction)) {
    throw new Error('Transaction is not a File Update Transaction');
  }
}

function reset() {
  request.value = null;
  appendProcessed.value = false;
}

/* Expose */
defineExpose({
  handle,
  setNext,
});
</script>
<template>
  <!-- Handler #1: Organization  -->
  <OrganizationRequestHandler
    ref="organizationHandler"
    :observers="observers"
    :approvers="approvers"
    @transaction:submit:success="handleSubmitSuccess"
    @transaction:submit:fail="handleSubmitFail"
  />
</template>
