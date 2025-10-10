<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import { Transaction, FreezeTransaction } from '@hashgraph/sdk';

import { uint8ToHex } from '@renderer/utils';
import { getFreezeTypeString } from '@renderer/utils/sdk/transactions';

import DateTimeString from '@renderer/components/ui/DateTimeString.vue';

/* Props */
const props = defineProps<{
  transaction: Transaction;
}>();

/* State */
const fileHashHex = ref('');

/* Hooks */
onBeforeMount(() => {
  if (!(props.transaction instanceof FreezeTransaction)) {
    throw new Error('Transaction is not Account Delete Transaction');
  }

  if (props.transaction.fileHash) {
    fileHashHex.value = uint8ToHex(props.transaction.fileHash);
  }
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';
</script>
<template>
  <div v-if="transaction instanceof FreezeTransaction && true" class="mt-5 row flex-wrap">
    <!-- Freeze Type -->
    <div v-if="transaction.freezeType" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Freeze Type</h4>
      <p :class="detailItemValueClass">
        {{ getFreezeTypeString(transaction.freezeType) }}
      </p>
    </div>

    <!-- Start Time -->
    <div v-if="transaction.startTimestamp" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Start Time</h4>
      <p :class="detailItemValueClass">
        <DateTimeString :date="transaction.startTimestamp.toDate()"/>
      </p>
    </div>

    <!-- File ID -->
    <div v-if="transaction.fileId" :class="commonColClass">
      <h4 :class="detailItemLabelClass">File ID</h4>
      <p :class="detailItemValueClass">
        {{ transaction.fileId.toString() }}
      </p>
    </div>

    <!-- File Hash -->
    <div v-if="transaction.fileHash" class="col-12 py-3">
      <h4 :class="detailItemLabelClass">File Hash</h4>
      <p :class="detailItemValueClass">
        {{ fileHashHex.startsWith('0x') ? fileHashHex : `0x${fileHashHex}` }}
      </p>
    </div>
  </div>
</template>
