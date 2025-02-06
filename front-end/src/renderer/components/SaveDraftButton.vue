<script setup lang="ts">
import type { Transaction } from '@hashgraph/sdk';
import { FileAppendTransaction, FileUpdateTransaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRoute, useRouter } from 'vue-router';

import { addDraft, getDraft, updateDraft } from '@renderer/services/transactionDraftsService';

import { getTransactionFromBytes, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';

const emit = defineEmits<{
  (event: 'draft-saved'): void;
}>();

/* Props */
const props = defineProps<{
  handleSaveDraft?: () => void;
  handleDraftAdded?: (id: string) => void;
  handleDraftUpdated?: (id: string) => void;
  getTransaction?: () => Transaction;
  description: string;
  isExecuted: boolean;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const route = useRoute();
const router = useRouter();

/* Handlers */
const handleDraft = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }
  const transactionBytes = getTransactionBytes();
  if (!transactionBytes) return;

  try {
    if (route.query.draftId) {
      const loadedDraft = await getDraft(route.query.draftId.toString());

      if (getTransactionFromBytes(loadedDraft.transactionBytes).toBytes() !== transactionBytes) {
        await updateDraft(loadedDraft.id, {
          transactionBytes: transactionBytes.toString(),
          description: props.description,
        });
        emit('draft-saved');
        toast.success('Draft updated');
        router.push('/transactions?tab=Drafts');
      }
    } else {
      await sendAddDraft(user.personal.id, transactionBytes);
      emit('draft-saved');
    }
  } catch (error) {
    console.log(error);
  }
};

/* Functions */
async function sendAddDraft(userId: string, transactionBytes: Uint8Array) {
  const { id } = await addDraft(userId, transactionBytes, props.description);
  props.handleDraftAdded && props.handleDraftAdded(id);
  router.push('/transactions?tab=Drafts');
  toast.success('Draft saved');
}

function getTransactionBytes() {
  if (!props.getTransaction) return;
  const transaction = props.getTransaction();
  if (
    transaction instanceof FileUpdateTransaction ||
    transaction instanceof FileAppendTransaction
  ) {
    //@ts-expect-error - contents should be null
    transaction.setContents(null);
  }
  return transaction.toBytes();
}
</script>
<template>
  <div>
    <AppButton
      color="secondary"
      type="button"
      data-testid="button-save-draft"
      @click="() => (handleSaveDraft ? handleSaveDraft() : handleDraft())"
      v-bind="$attrs"
      ><i class="bi bi-save"></i>
      {{ Boolean(route.query.draftId) ? 'Update Draft' : 'Save Draft' }}</AppButton
    >
  </div>
</template>
