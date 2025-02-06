<script setup lang="ts">
import { FileAppendTransaction, FileUpdateTransaction, type Transaction } from '@hashgraph/sdk';

import { computed, ref } from 'vue';

import { onBeforeRouteLeave, useRouter, useRoute } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';
import { useToast } from 'vue-toast-notification';
import {
  addDraft,
  draftExists,
  getDraft,
  updateDraft,
} from '@renderer/services/transactionDraftsService';
import { getTransactionFromBytes, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  skip?: boolean;
  getTransaction?: () => Transaction;
  description: string;
  isFromScratch: boolean;
  hasDataChanged: boolean;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const route = useRoute();
const toast = useToast();

/* State */
const isGroupActionModalShown = ref(false);

/* Emits */
const emit = defineEmits(['addToGroup', 'editGroupItem']);

/* Computed */
const isFromSingleTransaction = computed(() =>
  Boolean(route.query.draftId && route.query.group != 'true'),
);

/* Handlers */
function handleAddToGroup() {
  emit('addToGroup');
}

function handleEditGroupItem() {
  emit('editGroupItem');
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

const handleSingleTransaction = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }
  const transactionBytes = getTransactionBytes();
  if (!transactionBytes) return;

  try {
    if (route.query.draftId) {
      const loadedDraft = await getDraft(route.query.draftId.toString());

      if (getTransactionFromBytes(loadedDraft.transactionBytes).toBytes() != transactionBytes) {
        await updateDraft(loadedDraft.id, {
          transactionBytes: transactionBytes.toString(),
          description: props.description,
        });
        toast.success('Draft updated');
        router.push('/transactions?tab=Drafts');
      }
    } else {
      await sendAddDraft(user.personal.id, transactionBytes);
    }
  } catch (error) {
    console.log(error);
  }
};

async function sendAddDraft(userId: string, transactionBytes: Uint8Array) {
  await addDraft(userId, transactionBytes, props.description);
  router.push('/transactions?tab=Drafts');
  toast.success('Draft saved');
}

async function handleDiscard() {
  const previousPath = router.previousPath;
  if (isFromSingleTransaction.value || props.isFromScratch) {
    await router.push(previousPath);
  }
  await router.push(previousPath);
}

function handleGroupAction() {
  if (!route.params.seq) {
    handleAddToGroup();
  } else {
    handleEditGroupItem();
  }
}

async function handleSubmit() {
  if (isFromSingleTransaction.value || props.isFromScratch) {
    return await handleSingleTransaction();
  }
  return handleGroupAction();
}

/* else if (props.isFromScratch && !(await draftExists(transactionBytes))) {
      router.previousPath = '/transactions';
    } */

/* Hooks */
onBeforeRouteLeave(async () => {
  const transactionBytes = getTransactionBytes();
  if (!transactionBytes) return true;
  if ((await draftExists(transactionBytes)) && props.isFromScratch) {
    return true;
  }

  if (!props.skip && props.isFromScratch && !(await draftExists(transactionBytes))) {
    router.previousPath = '/transactions';
    isGroupActionModalShown.value = true;
    return false;
  }

  if (!props.skip && isGroupActionModalShown.value === false && props.hasDataChanged) {
    if (route.query.group === 'true') {
      router.previousPath = '/create-transaction-group';
    } else if (route.query.group !== 'true') {
      if (isFromSingleTransaction.value) {
        router.previousPath = '/transactions?tab=Drafts';
      } else if (props.isFromScratch) {
        router.previousPath = '/transactions';
      }
    }
    isGroupActionModalShown.value = true;
    return false;
  }

  return true;
});
</script>
<template>
  <AppModal
    :show="isGroupActionModalShown"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="small-modal"
  >
    <form class="text-center p-4" @submit.prevent="handleSubmit">
      <div class="text-start">
        <i class="bi bi-x-lg cursor-pointer" @click="isGroupActionModalShown = false"></i>
      </div>
      <h2
        v-if="!route.params.seq && !route.query.draftId && !isFromScratch"
        class="text-title text-semi-bold mt-3"
      >
        Add To Group?
      </h2>
      <h2 v-else class="text-title text-semi-bold mt-3">Save Edits?</h2>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton
          color="borderless"
          data-testid="button-discard-draft-for-group-modal"
          type="button"
          @click="handleDiscard"
          >Discard</AppButton
        >
        <AppButton
          v-if="!route.params.seq && !route.query.draftId && !isFromScratch"
          color="primary"
          data-testid="button-save-draft-modal"
          type="submit"
          >Add To Group</AppButton
        >
        <AppButton v-else color="primary" data-testid="button-save-draft-modal" type="submit"
          >Save Edits</AppButton
        >
      </div>
    </form>
  </AppModal>
</template>
