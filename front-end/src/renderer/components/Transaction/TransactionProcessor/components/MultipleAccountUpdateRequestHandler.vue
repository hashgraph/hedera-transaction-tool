<script setup lang="ts">
import { MultipleAccountUpdateRequest, type Handler, type Processable } from '..';
import type { IGroup, TransactionApproverDto } from '@main/shared/interfaces';
import type { GroupItem } from '@renderer/stores/storeTransactionGroup';
import type { ApiGroupItem } from '@renderer/services/organization';

import { ref } from 'vue';
import {
  AccountUpdateTransaction,
  TransactionResponse,
  TransactionReceipt,
  Hbar,
  AccountId,
  Transaction,
} from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { decryptPrivateKey, flattenKeyList } from '@renderer/services/keyPairService';
import {
  submitTransactionGroup,
  getApiGroupById,
  addObservers,
  addApprovers,
} from '@renderer/services/organization';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  getTransactionType,
  isAccountId,
  isLoggedInOrganization,
  safeAwait,
  uint8ToHex,
} from '@renderer/utils';
import {
  createTransactionId,
  getPrivateKey,
  type TransactionCommonData,
} from '@renderer/utils/sdk';

/* Props */
const props = defineProps<{
  observers: number[];
  approvers: TransactionApproverDto[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transaction:group:submit:success', id: number): void;
  (event: 'transaction:group:submit:fail', error: unknown): void;
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

const request = ref<MultipleAccountUpdateRequest | null>(null);

/* Actions */
function setNext(next: Handler) {
  nextHandler.value = next;
}

async function handle(req: Processable) {
  if (!(req instanceof MultipleAccountUpdateRequest)) {
    await nextHandler.value?.handle(req);
    return;
  }

  console.log('hereeeee');

  reset();
  request.value = req;

  const items = createGroupItems();

  if (isLoggedInOrganization(user.selectedOrganization)) {
    await processOrganization(items);
  } else {
    await processPersonal(items);
  }
}

/* Handlers */
const handleSignBegin = async () => emit('transaction:sign:begin');
const handleSignSuccess = async () => emit('transaction:sign:success');
const handleSignFail = async () => emit('transaction:sign:fail');

/* Functions */
function createGroupItems() {
  if (!request.value) {
    throw new Error('Request is missing');
  }
  return request.value.accountIds.map((acc, i) => createGroupItem(acc, i));
}

function createGroupItem(accountId: string, seq: number): GroupItem {
  if (!request.value) {
    throw new Error('Request is missing');
  }

  if (!request.value.payerId) {
    throw new Error('Payer ID is missing');
  }

  if (!request.value.baseValidStart) {
    throw new Error('Valid start is missing');
  }

  if (!request.value.maxTransactionFee) {
    throw new Error('Max transaction fee is missing');
  }

  accountId = AccountId.fromString(accountId).toString();

  const validStartSeq = new Date(request.value.baseValidStart.getTime() + seq);

  const commonData: TransactionCommonData = {
    payerId: request.value.payerId,
    validStart: validStartSeq,
    maxTransactionFee: request.value.maxTransactionFee as Hbar,
    transactionMemo: '',
  };

  const transaction = new AccountUpdateTransaction();
  if (isAccountId(commonData.payerId)) {
    transaction.setTransactionId(createTransactionId(commonData.payerId, commonData.validStart));
  }

  if (isAccountId(accountId)) {
    transaction.setAccountId(accountId);
  }

  transaction.setTransactionValidDuration(180);
  transaction.setMaxTransactionFee(commonData.maxTransactionFee);
  transaction.setKey(request.value.key);

  return {
    approvers: props.approvers,
    description: '',
    keyList: flattenKeyList(request.value.getAccountIdTransactionKey(accountId)).map(pk =>
      pk.toStringRaw(),
    ),
    observers: props.observers,
    payerAccountId: request.value.accountIsPayer ? accountId : commonData.payerId,
    seq: seq.toString(),
    transactionBytes: transaction.toBytes(),
    type: getTransactionType(transaction),
    validStart: commonData.validStart,
  };
}

async function processOrganization(items: GroupItem[]) {
  try {
    emit('loading:begin');
    await signGroupItems(items);
  } finally {
    emit('loading:end');
  }
}

async function processPersonal(items: GroupItem[]) {}

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
      'Automatically created group for multiple accounts update',
      false,
      true,
      apiGroupItems,
    );
    const group: IGroup = await getApiGroupById(user.selectedOrganization.serverUrl, id);
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
