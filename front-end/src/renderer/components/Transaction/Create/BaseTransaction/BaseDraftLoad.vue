<script setup lang="ts">
import { onMounted } from 'vue';
import {
  FileAppendTransaction,
  FileCreateTransaction,
  FileUpdateTransaction,
  type Transaction,
} from '@hashgraph/sdk';

import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useRoute } from 'vue-router';

import { getDraft } from '@renderer/services/transactionDraftsService';

import { getTransactionFromBytes } from '@renderer/utils';

/* Emits */
const emit = defineEmits<{
  (event: 'draft-loaded', transaction: Transaction): void;
}>();

/* Stores */
const transactionGroup = useTransactionGroupStore();

/* Composables */
const route = useRoute();

/* Handlers */
const handleLoadFromDraft = async () => {
  const draftId = route.query.draftId?.toString() || '';
  const groupIndex = route.query.groupIndex?.toString() || '';
  const group = route.query.group;

  if (!draftId && !groupIndex) {
    return;
  }

  let transactionBytes: string | null = null;

  if (!group) {
    const draft = await getDraft(draftId);
    transactionBytes = draft.transactionBytes;
  } else if (groupIndex) {
    transactionBytes = transactionGroup.groupItems[Number(groupIndex)].transactionBytes.toString();
  }

  if (transactionBytes) {
    const transaction = getTransactionFromBytes(transactionBytes);
    if (
      transaction instanceof FileCreateTransaction ||
      transaction instanceof FileUpdateTransaction ||
      (transaction instanceof FileAppendTransaction && transaction.contents?.length === 0)
    ) {
      //@ts-expect-error - contents should be null
      transaction.setContents(null);
    }
    emit('draft-loaded', transaction);
  }
};

/* Hooks */
onMounted(async () => {
  await handleLoadFromDraft();
});
</script>
<template>
  <div></div>
</template>
