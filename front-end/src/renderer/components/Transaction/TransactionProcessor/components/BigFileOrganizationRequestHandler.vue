<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces';
import type { GroupItem } from '@renderer/stores/storeTransactionGroup';
import {
  addApprovers,
  addObservers,
  type ApiGroupItem,
  type IGroup,
} from '@renderer/services/organization';
import { TransactionRequest, type Handler, type Processable } from '..';

import { ref } from 'vue';
import { Transaction, FileUpdateTransaction, Hbar, Key } from '@hashgraph/sdk';

import { TRANSACTION_MAX_SIZE } from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { decryptPrivateKey, flattenKeyList } from '@renderer/services/keyPairService';
import {
  getTransactionGroupById,
  submitTransactionGroup,
} from '@renderer/services/organization/transactionGroup';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  isLoggedInOrganization,
  safeAwait,
  uint8ToHex,
} from '@renderer/utils';
import {
  assertTransactionType,
  createFileAppendTransaction,
  getPrivateKey,
} from '@renderer/utils/sdk';
import { getTransactionType } from '@renderer/utils/sdk/transactions';

/* Constants */
const FIRST_CHUNK_SIZE_BYTES = 100;

/* Props */
const props = defineProps<{
  observers: number[];
  approvers: TransactionApproverDto[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transaction:group:submit:success', id: number): void;
  (event: 'transaction:group:submit:fail', error: unknown): void;
  (event: 'loading:begin'): void;
  (event: 'loading:end'): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const nextHandler = ref<Handler | null>(null);
const request = ref<TransactionRequest | null>(null);

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

  try {
    emit('loading:begin');
    const groupItems = createGroupItems(req);
    await signGroupItems(groupItems);
  } finally {
    emit('loading:end');
  }
}

/* Functions */

function createAppendTransaction() {
  if (!request.value) throw new Error('Request is missing');

  const originalTransaction = Transaction.fromBytes(request.value.transactionBytes);
  if (!originalTransaction) throw new Error('Transaction is missing');
  if (!isFileUpdate(originalTransaction))
    throw new Error('Transaction is not a File Update Transaction');

  if (!originalTransaction.contents) throw new Error('Transaction content is missing');

  const payerId = originalTransaction.transactionId?.accountId?.toString();
  const validStart = originalTransaction.transactionId?.validStart?.toDate();
  if (!payerId) throw new Error('Transaction payer ID is missing');
  if (!validStart) throw new Error('Transaction valid start is missing');

  const fileId = originalTransaction.fileId;
  if (!fileId) throw new Error('File ID is missing');

  const append = createFileAppendTransaction({
    payerId,
    validStart: new Date(validStart.getTime() + 10),
    maxTransactionFee: originalTransaction.maxTransactionFee || new Hbar(2),
    transactionMemo: originalTransaction.transactionMemo,
    fileId: fileId.toString(),
    contents: originalTransaction.contents.slice(FIRST_CHUNK_SIZE_BYTES),
    chunkSize: 2048,
    maxChunks: 99999,
  });

  return append;
}

function createGroupItem(transaction: Transaction, transactionKey: Key, seq: string): GroupItem {
  const payerId = transaction.transactionId?.accountId?.toString();
  const validStart = transaction.transactionId?.validStart?.toDate();
  if (!payerId || !validStart) {
    throw new Error('Transaction ID is missing');
  }
  const transactionBytes = transaction.toBytes();

  return {
    approvers: props.approvers,
    description: '',
    keyList: flattenKeyList(transactionKey).map(pk => pk.toStringRaw()),
    observers: props.observers,
    payerAccountId: payerId,
    seq,
    transactionBytes: transactionBytes,
    type: getTransactionType(transaction),
    validStart: validStart,
  };
}

function createGroupItems(req: TransactionRequest) {
  const originalTransaction = Transaction.fromBytes(req.transactionBytes);
  assertTransactionType(originalTransaction, FileUpdateTransaction);
  if (!originalTransaction.contents) throw new Error('Transaction content is missing');

  originalTransaction.setContents(originalTransaction.contents.slice(0, FIRST_CHUNK_SIZE_BYTES));
  const updateItem = createGroupItem(originalTransaction, req.transactionKey, '0');
  const appendItem = createGroupItem(createAppendTransaction(), req.transactionKey, '1');
  return [updateItem, appendItem];
}

async function signGroupItems(groupItems: GroupItem[]) {
  assertUserLoggedIn(user.personal);
  const personalPassword = getPassword(signGroupItems.bind(null, groupItems), {
    subHeading: 'Enter your application password to sign as a creator',
  });
  if (passwordModalOpened(personalPassword)) return;

  const keyToSignWith = user.keyPairs[0].public_key;
  const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, keyToSignWith);
  const privateKey = getPrivateKey(keyToSignWith, privateKeyRaw);

  await submitGroup(
    groupItems,
    groupItems.map(g => uint8ToHex(privateKey.sign(g.transactionBytes))),
    keyToSignWith,
  );
}

async function submitGroup(groupItems: GroupItem[], signature: string[], keyToSignWith: string) {
  assertIsLoggedInOrganization(user.selectedOrganization);

  const apiGroupItems: ApiGroupItem[] = [];
  for (const [i, groupItem] of groupItems.entries()) {
    const transaction = Transaction.fromBytes(groupItem.transactionBytes);
    apiGroupItems.push({
      seq: i,
      transaction: {
        name: transaction.transactionMemo || `New ${getTransactionType(transaction)}`,
        description: transaction.transactionMemo || '',
        transactionBytes: uint8ToHex(groupItems[i].transactionBytes),
        mirrorNetwork: network.network,
        signature: signature[i],
        creatorKeyId:
          user.selectedOrganization.userKeys.find(k => k.publicKey === keyToSignWith)?.id || -1,
      },
    });
  }

  try {
    const { id } = await submitTransactionGroup(
      user.selectedOrganization.serverUrl,
      'Automatically created group for large file update',
      false,
      true,
      apiGroupItems,
    );
    const group = await getTransactionGroupById(user.selectedOrganization.serverUrl, id, false);
    await safeAwait(submitApproversObservers(group));
    emit('transaction:group:submit:success', id);
  } catch (error) {
    emit('transaction:group:submit:fail', error);
    throw error;
  }
}

async function submitApproversObservers(group: IGroup) {
  assertIsLoggedInOrganization(user.selectedOrganization);
  const serverUrl = user.selectedOrganization.serverUrl;

  const promises = group.groupItems.map(groupItem => {
    const observerPromise =
      props.observers?.length > 0
        ? addObservers(serverUrl, groupItem.transactionId, props.observers)
        : Promise.resolve();

    const approverPromise =
      props.approvers?.length > 0
        ? addApprovers(serverUrl, groupItem.transactionId, props.approvers)
        : Promise.resolve();

    return Promise.allSettled([observerPromise, approverPromise]);
  });

  await Promise.allSettled(promises);
}

function isFileUpdate(transaction: Transaction): transaction is FileUpdateTransaction {
  return transaction instanceof FileUpdateTransaction;
}

function reset() {
  request.value = null;
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
