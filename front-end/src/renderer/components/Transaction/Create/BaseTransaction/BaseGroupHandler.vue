<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';
import type { KeyList, Transaction } from '@hashgraph/sdk';

import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useRouter } from 'vue-router';

import { flattenKeyList } from '@renderer/services/keyPairService';

import { getTransactionType } from '@renderer/utils';

/* Props */
const props = defineProps<{
  createTransaction: () => Transaction;
  transactionKey: KeyList;
}>();

/* Emits */
const transactionGroup = useTransactionGroupStore();

/* Composables */
const router = useRouter();

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
    observers: observers,
    approvers: approvers,
    payerAccountId: payerId,
    validStart: validStart,
    description: description,
  };
};

const addGroupItem = (
  description: string,
  payerId: string,
  validStart: Date,
  observers: number[],
  approvers: TransactionApproverDto[],
) => {
  transactionGroup.addGroupItem(
    buildActionData('add', description, payerId, validStart, observers, approvers),
  );
  router.push({ name: 'createTransactionGroup' });
};

const editGroupItem = (
  description: string,
  payerId: string,
  validStart: Date,
  observers: number[],
  approvers: TransactionApproverDto[],
) => {
  transactionGroup.editGroupItem(
    buildActionData('edit', description, payerId, validStart, observers, approvers),
  );
  router.push({ name: 'createTransactionGroup' });
};

/* Exposes */
defineExpose({
  addGroupItem,
  editGroupItem,
});
</script>
<template>
  <div></div>
</template>
