<script setup lang="ts">
import { onMounted } from 'vue';
import type { Transaction } from '@hashgraph/sdk';

import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useRoute } from 'vue-router';

import { getDraft } from '@renderer/services/transactionDraftsService';

import { getTransactionFromBytes } from '@renderer/utils';

/* Emits */
const emit = defineEmits<{
  (event: 'draft-loaded', transaction: Transaction): void;
  (event: 'details-loaded', details: string): void;
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
    if (draft.details) {
      emit('details-loaded', draft.details);
    }
  } else if (groupIndex) {
    transactionBytes = transactionGroup.groupItems[Number(groupIndex)].transactionBytes.toString();
  }

  if (transactionBytes) {
    const transaction = getTransactionFromBytes(transactionBytes);
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
