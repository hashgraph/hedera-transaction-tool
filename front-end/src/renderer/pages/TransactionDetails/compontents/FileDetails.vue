<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, ref } from 'vue';

import { FileCreateTransaction, Transaction, KeyList, FileUpdateTransaction } from '@hashgraph/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { saveFile } from '@renderer/services/electronUtilsService';
import { getTransactionInfo } from '@renderer/services/mirrorNodeDataService';

import { getFormattedDateFromTimestamp } from '@renderer/utils';

import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';

/* Props */
const props = defineProps<{
  transaction: Transaction;
}>();

/* Stores */
const network = useNetworkStore();

/* State */
const isKeyStructureModalShown = ref(false);
const controller = ref<AbortController | null>(null);
const entityId = ref<string | null>(null);

/* Hooks */
onBeforeMount(async () => {
  if (
    !(
      props.transaction instanceof FileCreateTransaction ||
      props.transaction instanceof FileUpdateTransaction
    )
  ) {
    throw new Error('Transaction is not Account Create or Update Transaction');
  }

  controller.value = new AbortController();

  const payer = props.transaction.transactionId?.accountId?.toString();
  const seconds = props.transaction.transactionId?.validStart?.seconds?.toString();
  const nanos = props.transaction.transactionId?.validStart?.nanos?.toString();

  try {
    const { transactions } = await getTransactionInfo(
      `${payer}-${seconds}-${nanos}`,
      network.mirrorNodeBaseURL,
      controller.value,
    );

    if (transactions.length > 0) {
      entityId.value = transactions[0].entity_id || null;
    }
  } catch (error) {
    /* Ignore if transaction not available in mirror node */
  }
});

onBeforeUnmount(() => {
  controller.value?.abort();
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-md-5 col-lg-4 col-xl-3 my-3';
</script>
<template>
  <div
    v-if="
      transaction instanceof FileCreateTransaction ||
      (transaction instanceof FileUpdateTransaction && true)
    "
    class="mt-5 row flex-wrap"
  >
    <!-- File ID -->
    <div
      v-if="transaction instanceof FileUpdateTransaction && transaction.fileId"
      class="col-12 mb-3"
    >
      <h4 :class="detailItemLabelClass">File ID</h4>
      <p :class="detailItemValueClass">
        {{ transaction.fileId.toString() }}
      </p>
    </div>
    <div v-if="transaction instanceof FileCreateTransaction && entityId" class="col-12 mb-3">
      <h4 :class="detailItemLabelClass">New File ID</h4>
      <p :class="detailItemValueClass">
        {{ entityId }}
      </p>
    </div>

    <!-- Key -->
    <div
      class="col-12 mb-3"
      :class="{ 'mt-3': transaction instanceof FileUpdateTransaction && transaction.fileId }"
    >
      <h4 :class="detailItemLabelClass">Key</h4>
      <p :class="detailItemValueClass">
        <template v-if="transaction.keys">
          <span class="link-primary cursor-pointer" @click="isKeyStructureModalShown = true"
            >See details</span
          >
        </template>
        <template v-else>None</template>
      </p>
    </div>

    <!-- Memo -->
    <div v-if="transaction.fileMemo && transaction.fileMemo.trim().length > 0" class="col-12 my-3">
      <h4 :class="detailItemLabelClass">Memo</h4>
      <p :class="detailItemValueClass">
        {{ transaction.fileMemo }}
      </p>
    </div>

    <!-- Expiration Time -->
    <div v-if="transaction.expirationTime" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Expiration Time</h4>
      <p :class="detailItemValueClass">
        {{ getFormattedDateFromTimestamp(transaction.expirationTime) }}
      </p>
    </div>

    <!-- Contents -->
    <div v-if="transaction.contents" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Contents</h4>
      <p :class="detailItemValueClass">
        <span class="link-primary cursor-pointer" @click="saveFile(transaction.contents)"
          >View</span
        >
      </p>
    </div>

    <KeyStructureModal
      v-model:show="isKeyStructureModalShown"
      :account-key="new KeyList(transaction.keys)"
    />
  </div>
</template>
