<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, ref } from 'vue';

import { FileCreateTransaction, Transaction, KeyList, FileUpdateTransaction } from '@hashgraph/sdk';
import { HederaFile } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';

import { saveFile } from '@renderer/services/electronUtilsService';
import { getTransactionInfo } from '@renderer/services/mirrorNodeDataService';
import { add, getAll } from '@renderer/services/filesService';

import { getFormattedDateFromTimestamp } from '@renderer/utils';
import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  transaction: Transaction;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();

/* State */
const isKeyStructureModalShown = ref(false);
const controller = ref<AbortController | null>(null);
const entityId = ref<string | null>(null);
const files = ref<HederaFile[]>([]);

/* Handlers */
const handleLinkEntity = async () => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User not logged in');
  if (!entityId.value) throw new Error('Entity ID not available');

  await add({
    user_id: user.personal.id,
    file_id: entityId.value,
    network: network.network,
  });

  files.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });

  toast.success(`File ${entityId.value} linked`, { position: 'bottom-right' });
};

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
  if (!isUserLoggedIn(user.personal)) throw new Error('User not logged in');

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

  files.value = await getAll({
    where: {
      user_id: user.personal.id,
      network: network.network,
    },
  });
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
      <div class="flex-centered justify-content-start gap-4">
        <div>
          <h4 :class="detailItemLabelClass">New File ID</h4>
          <p :class="detailItemValueClass">
            {{ entityId }}
          </p>
        </div>
        <div>
          <AppButton
            v-if="!files.some(f => f.file_id === entityId)"
            class="min-w-unset"
            color="secondary"
            size="small"
            @click="handleLinkEntity"
            >Link File</AppButton
          >
          <span
            v-if="files.some(f => f.file_id === entityId)"
            class="align-self-start text-small text-secondary"
            >File already linked</span
          >
        </div>
      </div>
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
