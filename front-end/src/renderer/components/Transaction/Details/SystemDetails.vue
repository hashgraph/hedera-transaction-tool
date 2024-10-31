<script setup lang="ts">
import type { ITransactionFull } from '@main/shared/interfaces';

import { onBeforeMount } from 'vue';

import { Transaction, SystemDeleteTransaction, SystemUndeleteTransaction } from '@hashgraph/sdk';

import { getFormattedDateFromTimestamp } from '@renderer/utils';

/* Props */
const props = defineProps<{
  transaction: Transaction;
  organizationTransaction: ITransactionFull | null;
}>();

/* Hooks */
onBeforeMount(async () => {
  if (
    !(
      props.transaction instanceof SystemDeleteTransaction ||
      props.transaction instanceof SystemUndeleteTransaction
    )
  ) {
    throw new Error('Transaction is not System Delete, System Undelete');
  }
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';
</script>
<template>
  <div
    v-if="
      transaction instanceof SystemDeleteTransaction ||
      transaction instanceof SystemUndeleteTransaction
    "
    class="mt-5 row flex-wrap"
  >
    <!-- File ID -->
    <div v-if="transaction.fileId" :class="commonColClass">
      <h4 :class="detailItemLabelClass">File ID</h4>
      <p :class="detailItemValueClass" data-testid="p-system-details-file-id">
        {{ transaction.fileId.toString() }}
      </p>
    </div>

    <!-- Contract ID -->
    <div v-if="transaction.contractId" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Contract ID</h4>
      <p :class="detailItemValueClass" data-testid="p-system-details-contract-id">
        {{ transaction.contractId.toString() }}
      </p>
    </div>

    <!-- Expiration Time -->
    <div
      v-if="transaction instanceof SystemDeleteTransaction && transaction.expirationTime"
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Expiration Time</h4>
      <p :class="detailItemValueClass" data-testid="p-system-details-expiration-time">
        {{ getFormattedDateFromTimestamp(transaction.expirationTime) }}
      </p>
    </div>
  </div>
</template>
