<script setup lang="ts">
import { TransactionRequest, type Handler, type Processable } from '..';

import { computed, ref } from 'vue';
import {
  Transaction,
  FileCreateTransaction,
  FileUpdateTransaction,
  TransactionResponse,
  TransactionReceipt,
  FileAppendTransaction,
} from '@hashgraph/sdk';

import { TRANSACTION_MAX_SIZE } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { isLoggedInOrganization } from '@renderer/utils';
import { createTransactionId } from '@renderer/utils/sdk';

import SignPersonalRequestHandler from './SignPersonalRequestHandler.vue';
import ExecutePersonalRequestHandler from './ExecutePersonalRequestHandler.vue';

import { assertHandlerExists } from '..';

/* Constants */
const FIRST_CHUNK_SIZE_BYTES = 100;
const SIZE_BUFFER_BYTES = 200;

/* Emits */
const emit = defineEmits<{
  (event: 'transaction:sign:begin'): void;
  (event: 'transaction:sign:success'): void;
  (event: 'transaction:sign:fail'): void;
  (
    event: 'transaction:executed',
    success: boolean,
    response: TransactionResponse | null,
    receipt: TransactionReceipt | null,
  ): void;
  (event: 'transaction:stored', id: string): void;
}>();

/* Stores */
const user = useUserStore();

/* State */
const signPersonalHandler = ref<InstanceType<typeof SignPersonalRequestHandler> | null>(null);
const executePersonalHandler = ref<InstanceType<typeof ExecutePersonalRequestHandler> | null>(null);
const nextHandler = ref<Handler | null>(null);

const request = ref<TransactionRequest | null>(null);
const fileId = ref<string | null>(null);
const originalProcessed = ref<boolean>(false);
const originalResponse = ref<TransactionResponse | null>(null);
const originalReceipt = ref<TransactionReceipt | null>(null);
const originalLocalId = ref<string | null>(null);

/* Computed */
const originalTransaction = computed(() =>
  request.value ? Transaction.fromBytes(request.value.transactionBytes) : null,
);
const content = computed(() => {
  if (!originalTransaction.value) return null;
  if (!isFileCreateOrUpdate(originalTransaction.value)) return null;
  return originalTransaction.value.contents;
});

/* Actions */
function setNext(next: Handler) {
  nextHandler.value = next;
}

async function handle(req: Processable) {
  if (!(req instanceof TransactionRequest)) {
    await nextHandler.value?.handle(req);
    return;
  }

  const transaction = Transaction.fromBytes(req.transactionBytes);
  const size = transaction.toBytes().length;

  if (
    isLoggedInOrganization(user.selectedOrganization) ||
    !isFileCreateOrUpdate(transaction) ||
    size <= TRANSACTION_MAX_SIZE - SIZE_BUFFER_BYTES ||
    !transaction.contents
  ) {
    await nextHandler.value?.handle(req);
    return;
  }

  reset();
  request.value = req;

  buildChain();

  await processOriginal();
}

/* Handlers */
const handleSignBegin = async () => emit('transaction:sign:begin');
const handleSignSuccess = async () => emit('transaction:sign:success');
const handleSignFail = async () => emit('transaction:sign:fail');

const handleTransactionExecuted = async (
  success: boolean,
  response: TransactionResponse | null,
  receipt: TransactionReceipt | null,
) => {
  if (!success) {
    emit('transaction:executed', success, response, receipt);
    return;
  }

  if (!receipt) throw new Error('Receipt is missing');

  if (!originalProcessed.value) {
    originalProcessed.value = true;
    handleOrginialExecuted(response, receipt);
    await processAppend();
  } else {
    handleAppendExecuted(success);
  }
};

const handleOrginialExecuted = (
  response: TransactionResponse | null,
  receipt: TransactionReceipt,
) => {
  if (originalTransaction.value instanceof FileCreateTransaction) {
    if (!receipt.fileId) throw new Error('File ID is missing in the receipt');
    fileId.value = receipt.fileId?.toString();
  } else if (originalTransaction.value instanceof FileUpdateTransaction) {
    if (!originalTransaction.value.fileId) throw new Error('File ID is missing');
    fileId.value = originalTransaction.value.fileId.toString();
    //TODO: Check if the keys are updated and execute the append with new transaction key
  }

  originalResponse.value = response;
  originalReceipt.value = receipt;
};

const handleAppendExecuted = (success: boolean) => {
  if (
    !(originalResponse.value instanceof TransactionResponse) ||
    !(originalReceipt.value instanceof TransactionReceipt)
  ) {
    throw new Error('Original response or receipt is missing');
  }
  emit('transaction:executed', success, originalResponse.value, originalReceipt.value);
};

const handleTransactionStore = async (id: string) => {
  if (!originalLocalId.value) {
    originalLocalId.value = id;
    return;
  } else {
    emit('transaction:stored', originalLocalId.value);
  }
};

/* Functions */
function buildChain() {
  assertHandlerExists<typeof SignPersonalRequestHandler>(
    signPersonalHandler.value,
    'Sign Personal',
  );
  assertHandlerExists<typeof ExecutePersonalRequestHandler>(
    executePersonalHandler.value,
    'Execute Personal',
  );

  signPersonalHandler.value.setNext(executePersonalHandler.value);
}

async function startChain(req: TransactionRequest) {
  assertHandlerExists<typeof SignPersonalRequestHandler>(
    signPersonalHandler.value,
    'Sign Personal',
  );
  await signPersonalHandler.value.handle(req);
}

async function processOriginal() {
  if (!request.value) throw new Error('Transaction request is missing');

  const transaction = Transaction.fromBytes(request.value.transactionBytes);

  assertTransactionType(transaction);
  if (!content.value) throw new Error('Transaction content is missing');

  transaction.setContents(content.value.slice(0, FIRST_CHUNK_SIZE_BYTES));

  await startChain(
    TransactionRequest.fromData({
      transactionBytes: transaction.toBytes(),
      transactionKey: request.value.transactionKey,
      name: request.value.name,
      description: request.value.description,
      submitManually: false,
      reminderMillisecondsBefore: null,
    }),
  );
}

async function processAppend() {
  if (!request.value) throw new Error('Transaction request is missing');

  const transaction = createAppendTransaction();

  await startChain(
    TransactionRequest.fromData({
      transactionBytes: transaction.toBytes(),
      transactionKey: request.value.transactionKey,
      name: request.value.name,
      description: request.value.description,
      submitManually: false,
      reminderMillisecondsBefore: null,
    }),
  );
}

function createAppendTransaction() {
  if (!originalTransaction.value) throw new Error('Transaction is missing');
  if (!content.value) throw new Error('Transaction content is missing');
  if (!fileId.value) throw new Error('File ID is missing');

  const originalTransactionId = originalTransaction.value.transactionId;
  const maxTransactionFee = originalTransaction.value.maxTransactionFee;
  if (!originalTransactionId) throw new Error('Original transaction ID is missing');
  if (!originalTransactionId.accountId) throw new Error('Transaction payer ID is missing');
  if (!originalTransactionId.validStart) throw new Error('Transaction valid start is missing');
  if (!maxTransactionFee) throw new Error('Transaction max fee is missing');

  const append = new FileAppendTransaction()
    .setTransactionValidDuration(180)
    .setMaxTransactionFee(maxTransactionFee)
    .setTransactionId(
      createTransactionId(
        originalTransactionId.accountId,
        originalTransactionId.validStart.plusNanos(10),
      ),
    )
    .setFileId(fileId.value)
    .setContents(content.value.slice(FIRST_CHUNK_SIZE_BYTES))
    .setMaxChunks(99999);

  return append;
}

function isFileCreateOrUpdate(
  transaction: Transaction,
): transaction is FileCreateTransaction | FileUpdateTransaction {
  return (
    transaction instanceof FileCreateTransaction || transaction instanceof FileUpdateTransaction
  );
}

function assertTransactionType(
  transaction: Transaction,
): asserts transaction is FileCreateTransaction | FileUpdateTransaction {
  if (!isFileCreateOrUpdate(transaction)) {
    throw new Error('Transaction is not a File Create Transaction or File Update Transaction');
  }
}

function reset() {
  request.value = null;
  fileId.value = null;
  originalProcessed.value = false;
  originalResponse.value = null;
  originalReceipt.value = null;
  originalLocalId.value = null;
}

/* Expose */
defineExpose({
  handle,
  setNext,
});
</script>
<template>
  <!-- Handler #2: Sign in Personal -->
  <SignPersonalRequestHandler
    ref="signPersonalHandler"
    @transaction:sign:begin="handleSignBegin"
    @transaction:sign:success="handleSignSuccess"
    @transaction:sign:fail="handleSignFail"
  />

  <!-- Handler #3: Execute Personal -->
  <ExecutePersonalRequestHandler
    ref="executePersonalHandler"
    @transaction:executed="handleTransactionExecuted"
    @transaction:stored="handleTransactionStore"
  />
</template>
