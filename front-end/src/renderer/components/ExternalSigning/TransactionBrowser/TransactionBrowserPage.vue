<script setup lang="ts">
import { computed } from 'vue';
import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
  FileCreateTransaction,
  FileUpdateTransaction,
  FileAppendTransaction,
  FreezeTransaction,
  NodeCreateTransaction,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  TransferTransaction,
  Transaction as SDKTransaction,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
} from '@hashgraph/sdk';
import type { ITransactionBrowserItem } from './ITransactionBrowserItem';
import { hexToUint8Array } from '@renderer/utils';
import { getTransactionType, getTransactionValidStart } from '@renderer/utils/sdk/transactions.ts';
import TransactionBrowserKeySection from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserKeySection.vue';

/* Props */
const props = defineProps<{
  item: ITransactionBrowserItem;
}>();

/* Computed */
const transaction = computed(() => {
  let result: SDKTransaction | null;
  try {
    const transactionBytes = hexToUint8Array(props.item.transactionBytes);
    result = SDKTransaction.fromBytes(transactionBytes);
  } catch {
    result = null;
  }
  return result;
});
const transactionId = computed(() => transaction.value?.transactionId);
const transactionType = computed(() => {
  return transaction.value !== null ? getTransactionType(transaction.value, false, true) : null;
});
const description = computed(() => props.item.description ?? '');
const validStartDate = computed(() => {
  return transaction.value !== null ? getTransactionValidStart(transaction.value) : null;
});
const creatorEmail = computed(() => props.item.creatorEmail ?? '');
</script>

<template>
  <div>
    <div>Transaction ID: {{ transactionId?.toString() }}</div>
    <div>Transaction Type: {{ transactionType }}</div>
    <div>Valid Start: {{ validStartDate }}</div>
    <div>description: {{ description }}</div>
    <div>Creator e-mail: {{ creatorEmail }}</div>

    <div
      v-if="
        transaction instanceof FileCreateTransaction ||
        transaction instanceof FileUpdateTransaction ||
        transaction instanceof FileAppendTransaction
      "
    >
      File transaction properties
    </div>
    <div
      v-if="
        transaction instanceof AccountCreateTransaction ||
        transaction instanceof AccountUpdateTransaction
      "
    >
      Account delete transaction properties
    </div>
    <div v-if="transaction instanceof AccountDeleteTransaction">Account transaction properties</div>
    <div v-if="transaction instanceof TransferTransaction">Transfer transaction properties</div>
    <div v-if="transaction instanceof AccountAllowanceApproveTransaction">
      Allowance transaction properties
    </div>
    <div v-if="transaction instanceof FreezeTransaction">Freeze transaction properties</div>
    <div
      v-if="
        transaction instanceof SystemDeleteTransaction ||
        transaction instanceof SystemUndeleteTransaction
      "
    >
      System delete/undelete transaction properties
    </div>
    <div
      v-if="
        transaction instanceof NodeCreateTransaction ||
        transaction instanceof NodeUpdateTransaction ||
        transaction instanceof NodeDeleteTransaction
      "
    >
      System delete/undelete transaction properties
    </div>
    <div>
      <div>Collected Signatures</div>
      <TransactionBrowserKeySection :item="props.item" />
    </div>
  </div>
</template>
