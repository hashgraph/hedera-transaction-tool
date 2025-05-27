<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';
import type { KeyList, Transaction } from '@hashgraph/sdk';

import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useRoute, useRouter } from 'vue-router';

import { flattenKeyList } from '@renderer/services/keyPairService';

import { onMounted } from 'vue';
import { getTransactionType } from '@renderer/utils/sdk/transactions';

/* Props */
const props = defineProps<{
  createTransaction: () => Transaction;
  transactionKey: KeyList;
}>();

/* Stores */
const transactionGroup = useTransactionGroupStore();

/* Emits */
const emit = defineEmits(['fetchedDescription', 'fetchedPayerAccountId']);

/* Composables */
const router = useRouter();
const route = useRoute();

/* Functions */
const getTransactionData = (): [string, Uint8Array, string[]] => {
  const transaction = props.createTransaction();
  return [
    getTransactionType(transaction),
    transaction.toBytes(),
    flattenKeyList(props.transactionKey).map(pk => pk.toStringRaw()),
  ];
};

const buildActionData = (
  action: 'add' | 'edit',
  description: string,
  payerId: string,
  validStart: Date,
  observers: number[],
  approvers: TransactionApproverDto[],
) => {
  const [type, transactionBytes, keys] = getTransactionData();

  const route = router.currentRoute.value;
  const groupIndex = Number(route.query?.groupIndex?.toString() || 0);

  const seq =
    action === 'add' ? transactionGroup.groupItems.length.toString() : route.params.seq[0];
  const groupId = action === 'add' ? undefined : transactionGroup.groupItems[groupIndex]?.groupId;

  return {
    transactionBytes: transactionBytes,
    type,
    accountId: '',
    seq,
    groupId,
    keyList: keys,
    observers,
    approvers,
    payerAccountId: payerId,
    validStart,
    description,
  };
};

const addGroupItem = (
  description: string,
  payerId: string,
  validStart: Date,
  observers: number[],
  approvers: TransactionApproverDto[],
  path?: string,
) => {
  transactionGroup.addGroupItem(
    buildActionData('add', description, payerId, validStart, observers, approvers),
  );
  path ? router.push(path) : router.push({ name: 'createTransactionGroup' });
};

const editGroupItem = (
  description: string,
  payerId: string,
  validStart: Date,
  observers: number[],
  approvers: TransactionApproverDto[],
  path?: string,
) => {
  transactionGroup.editGroupItem(
    buildActionData('edit', description, payerId, validStart, observers, approvers),
  );
  path ? router.push(path) : router.push({ name: 'createTransactionGroup' });
};

/* Exposes */
defineExpose({
  addGroupItem,
  editGroupItem,
});

/* Hooks */
onMounted(async () => {
  if (route.query.groupIndex) {
    const groupItem =
      transactionGroup.groupItems[Number.parseInt(route.query.groupIndex as string)];
    emit('fetchedDescription', groupItem.description);
    emit('fetchedPayerAccountId', groupItem.payerAccountId);
  }
});
</script>
<template>
  <div></div>
</template>
