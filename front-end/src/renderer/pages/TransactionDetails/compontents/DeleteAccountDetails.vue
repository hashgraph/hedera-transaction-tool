<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import { Transaction, AccountDeleteTransaction } from '@hashgraph/sdk';

import { ITransactionFull, TransactionStatus } from '@main/shared/interfaces';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { getTransactionInfo } from '@renderer/services/mirrorNodeDataService';

/* Props */
const props = defineProps<{
  transaction: Transaction;
  organizationTransaction: ITransactionFull | null;
}>();

/* Stores */
const network = useNetworkStore();

/* State */
const controller = ref<AbortController | null>(null);
// const transfers = ref<Transfer[] | null>(null);

/* Functions */
async function fetchTransactionInfo(payer: string, seconds: string, nanos: string) {
  try {
    const { transactions } = await getTransactionInfo(
      `${payer}-${seconds}-${nanos}`,
      network.mirrorNodeBaseURL,
      controller.value || undefined,
    );

    if (transactions.length > 0 && props.transaction instanceof AccountDeleteTransaction) {
      // transfers.value = transactions[0].transfers || null;
      const deletedAccountId = props.transaction.accountId?.toString();
      const transferredAmount = transactions[0].transfers?.find(
        transfer => transfer.account?.toString() === deletedAccountId,
      )?.amount;
      console.log('transferredAmount', transferredAmount);
    }
  } catch (error) {
    /* Ignore if transaction not available in mirror node */
  }
}

/* Hooks */
onBeforeMount(async () => {
  if (!(props.transaction instanceof AccountDeleteTransaction)) {
    throw new Error('Transaction is not Account Delete Transaction');
  }

  const isExecutedOrganizationTransaction = Boolean(
    props.organizationTransaction?.status &&
      [TransactionStatus.EXECUTED, TransactionStatus.FAILED].includes(
        props.organizationTransaction.status,
      ),
  );

  if (
    (isExecutedOrganizationTransaction || !props.organizationTransaction) &&
    props.transaction instanceof AccountDeleteTransaction
  ) {
    const payer = props.transaction.transactionId?.accountId?.toString();
    const seconds = props.transaction.transactionId?.validStart?.seconds?.toString();
    const nanos = props.transaction.transactionId?.validStart?.nanos?.toString();

    if (payer && seconds && nanos) {
      if (!props.organizationTransaction) {
        setTimeout(async () => await fetchTransactionInfo(payer, seconds, nanos), 1500);
      } else {
        await fetchTransactionInfo(payer, seconds, nanos);
      }
    }
  }
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';
</script>
<template>
  <div v-if="transaction instanceof AccountDeleteTransaction && true" class="mt-5 row flex-wrap">
    <!-- Account ID -->
    <div v-if="transaction.accountId" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Account ID</h4>
      <p :class="detailItemValueClass" data-testid="p-account-delete-details-account-id">
        {{ transaction.accountId.toString() }}
      </p>
    </div>

    <!-- Transfer account ID -->
    <div v-if="transaction.transferAccountId" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Transfer Account ID</h4>
      <p :class="detailItemValueClass" data-testid="p-account-delete-details-transfer-account-id">
        {{ transaction.transferAccountId.toString() }}
      </p>
    </div>
  </div>
</template>
