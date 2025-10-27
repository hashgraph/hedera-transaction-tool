<script setup lang="ts">
import type { HederaFile } from '@prisma/client';
import type { ITransactionFull } from '@shared/interfaces';

import { onBeforeMount, onBeforeUnmount, ref } from 'vue';

import {
  FileCreateTransaction,
  Transaction,
  KeyList,
  FileUpdateTransaction,
  FileAppendTransaction,
} from '@hashgraph/sdk';

import { TransactionStatus } from '@shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';

import { saveFile } from '@renderer/services/electronUtilsService';
import { getTransactionInfo } from '@renderer/services/mirrorNodeDataService';
import { add, getAll } from '@renderer/services/filesService';

import { isUserLoggedIn, getFormattedDateFromTimestamp, safeAwait } from '@renderer/utils';

import KeyStructureModal from '@renderer/components/KeyStructureModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  transaction: Transaction;
  organizationTransaction: ITransactionFull | null;
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

  toast.success(`File ${entityId.value} linked`);
};

/* Functions */
async function fetchTransactionInfo(payer: string, seconds: string, nanos: string) {
  const { data } = await safeAwait(
    getTransactionInfo(
      `${payer}-${seconds}-${nanos}`,
      network.mirrorNodeBaseURL,
      controller.value || undefined,
    ),
  );

  if (data?.transactions && data.transactions.length > 0) {
    entityId.value = data.transactions[0].entity_id || null;
  }
}

/* Hooks */
onBeforeMount(async () => {
  if (
    !(
      props.transaction instanceof FileCreateTransaction ||
      props.transaction instanceof FileUpdateTransaction ||
      props.transaction instanceof FileAppendTransaction
    )
  ) {
    throw new Error('Transaction is not File Create, Update nor Append Transaction');
  }
  if (!isUserLoggedIn(user.personal)) throw new Error('User not logged in');

  const isExecutedOrganizationTransaction = Boolean(
    props.organizationTransaction?.status &&
      [TransactionStatus.EXECUTED, TransactionStatus.FAILED].includes(
        props.organizationTransaction.status,
      ),
  );

  if (
    (isExecutedOrganizationTransaction || !props.organizationTransaction) &&
    props.transaction instanceof FileCreateTransaction
  ) {
    controller.value = new AbortController();

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

    files.value = await getAll({
      where: {
        user_id: user.personal.id,
        network: network.network,
      },
    });
  }
});

onBeforeUnmount(() => {
  controller.value?.abort();
});

/* Misc */
const detailItemLabelClass = 'text-micro text-semi-bold text-dark-blue';
const detailItemValueClass = 'text-small overflow-hidden mt-1';
const commonColClass = 'col-6 col-lg-5 col-xl-4 col-xxl-3 overflow-hidden py-3';
</script>
<template>
  <div
    v-if="
      transaction instanceof FileCreateTransaction ||
      transaction instanceof FileUpdateTransaction ||
      transaction instanceof FileAppendTransaction
    "
    class="mt-5 row flex-wrap"
  >
    <!-- File ID -->
    <div
      v-if="
        (transaction instanceof FileUpdateTransaction ||
          transaction instanceof FileAppendTransaction) &&
        transaction.fileId
      "
      class="col-12 mb-3"
    >
      <h4 :class="detailItemLabelClass">File ID</h4>
      <p :class="detailItemValueClass" data-testid="p-file-details-file-id">
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
            type="button"
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
      v-if="
        (transaction instanceof FileUpdateTransaction ||
          transaction instanceof FileCreateTransaction) &&
        transaction.keys !== null
      "
      class="col-12 mb-3"
      :class="{ 'mt-3': transaction instanceof FileUpdateTransaction && transaction.fileId }"
    >
      <h4 :class="detailItemLabelClass">Key</h4>
      <p :class="detailItemValueClass" data-testid="p-file-details-key-text">
        <template v-if="transaction.keys">
          <span
            class="link-primary cursor-pointer"
            data-testid="button-file-details-key"
            @click="isKeyStructureModalShown = true"
            >See details</span
          >
        </template>
        <template v-else>None</template>
      </p>
    </div>

    <!-- Memo -->
    <div
      v-if="
        (transaction instanceof FileUpdateTransaction ||
          transaction instanceof FileCreateTransaction) &&
        transaction.fileMemo &&
        transaction.fileMemo.trim().length > 0
      "
      class="col-12 my-3"
    >
      <h4 :class="detailItemLabelClass">Memo</h4>
      <p :class="detailItemValueClass">
        {{ transaction.fileMemo }}
      </p>
    </div>

    <!-- Expiration Time -->
    <div
      v-if="
        (transaction instanceof FileUpdateTransaction ||
          transaction instanceof FileCreateTransaction) &&
        transaction.expirationTime
      "
      :class="commonColClass"
    >
      <h4 :class="detailItemLabelClass">Expiration Time</h4>
      <p :class="detailItemValueClass" data-testid="p-file-details-expiration-time">
        {{ getFormattedDateFromTimestamp(transaction.expirationTime) }}
      </p>
    </div>

    <!-- Contents -->
    <div v-if="transaction.contents !== null" :class="commonColClass">
      <h4 :class="detailItemLabelClass">Contents</h4>
      <p :class="detailItemValueClass">
        <span
          class="link-primary cursor-pointer"
          data-testid="button-view-file-contents"
          @click="saveFile(transaction.contents)"
          >View</span
        >
      </p>
    </div>

    <KeyStructureModal
      v-if="
        transaction instanceof FileUpdateTransaction || transaction instanceof FileCreateTransaction
      "
      v-model:show="isKeyStructureModalShown"
      :account-key="new KeyList(transaction.keys)"
    />
  </div>
</template>
