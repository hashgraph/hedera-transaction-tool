<script lang="ts" setup>
import { onMounted } from 'vue';
import { type Transaction } from '@hiero-ledger/sdk';

import useTransactionGroupStore from '@renderer/stores/storeTransactionGroup';

import { useRoute } from 'vue-router';

import { getDraft } from '@renderer/services/transactionDraftsService';

import { getTransactionFromBytes } from '@renderer/utils';

/* Emits */
const emit = defineEmits<{
  (event: 'draft-loaded', transaction: Transaction, baseline: Transaction | null, description: string): void;
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
  let baselineBytes: string | null = null;
  let description = '';

  if (!group) {
    const draft = await getDraft(draftId);
    transactionBytes = draft.transactionBytes;
    baselineBytes = draft.baselineBytes;
    description = draft.description || '';
  } else if (groupIndex) {
    const groupItem = transactionGroup.groupItems[Number(groupIndex)];
    transactionBytes = groupItem.transactionBytes.toString();
    transactionBytes = groupItem.baselineBytes?.toString() ?? null;
    description = groupItem.description || '';
  }

  if (transactionBytes) {
    const transaction = getTransactionFromBytes(transactionBytes);
    const baseline = baselineBytes !== null ? getTransactionFromBytes(baselineBytes) : null;
    emit('draft-loaded', transaction, baseline, description);
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
