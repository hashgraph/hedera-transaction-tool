<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import { Transaction, FreezeTransaction } from '@hashgraph/sdk';
import { getDateStringExtended } from '@renderer/utils';
import { uint8ArrayToHex } from '@renderer/services/electronUtilsService';

/* Props */
const props = defineProps<{
  transaction: Transaction;
}>();

/* State */
const fileHashHex = ref('');

/* Hooks */
onBeforeMount(async () => {
  if (!(props.transaction instanceof FreezeTransaction)) {
    throw new Error('Transaction is not Account Delete Transaction');
  }

  if (props.transaction.fileHash) {
    console.log(props.transaction.fileHash);

    fileHashHex.value = await uint8ArrayToHex(props.transaction.fileHash);
  }
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-md-5 col-lg-4 col-xl-3 py-3';
</script>
<template>
  <div v-if="transaction instanceof FreezeTransaction && true" class="mt-5 row flex-wrap">
    <!-- Freeze Type -->
    <div v-if="transaction.freezeType" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Freeze Type</h4>
      <p :class="detailItemValueClass">
        {{ transaction.freezeType.toString() }}
      </p>
    </div>

    <!-- Start Time -->
    <div v-if="transaction.startTimestamp" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Start Time</h4>
      <p :class="detailItemValueClass">
        {{ getDateStringExtended(transaction.startTimestamp.toDate()) }}
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
