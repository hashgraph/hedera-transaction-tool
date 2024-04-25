<script setup lang="ts">
import { onBeforeMount } from 'vue';

import { Transaction, AccountDeleteTransaction } from '@hashgraph/sdk';

/* Props */
const props = defineProps<{
  transaction: Transaction;
}>();

/* Hooks */
onBeforeMount(() => {
  if (!(props.transaction instanceof AccountDeleteTransaction)) {
    throw new Error('Transaction is not Account Delete Transaction');
  }
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-md-5 col-lg-4 col-xl-3 py-3';
</script>
<template>
  <div v-if="transaction instanceof AccountDeleteTransaction && true" class="mt-5 row flex-wrap">
    <!-- Account ID -->
    <div v-if="transaction.accountId" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Account ID</h4>
      <p :class="detailItemValueClass">
        {{ transaction.accountId.toString() }}
      </p>
    </div>

    <!-- Transfer account ID -->
    <div v-if="transaction.transferAccountId" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Transfer Account ID</h4>
      <p :class="detailItemValueClass">
        {{ transaction.transferAccountId.toString() }}
      </p>
    </div>
  </div>
</template>
