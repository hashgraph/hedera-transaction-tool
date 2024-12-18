<script setup lang="ts">
import type { RouteLocationNormalized } from 'vue-router';
import type { Transaction } from '@hashgraph/sdk';

import { ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { FileAppendTransaction, FileUpdateTransaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRoute, useRouter } from 'vue-router';

import {
  addDraft,
  draftExists,
  getDraft,
  updateDraft,
} from '@renderer/services/transactionDraftsService';

import { getTransactionFromBytes, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

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

/* State */
const routeTo = ref<RouteLocationNormalized | null>(null);
const isSaveDraftModalShown = ref(false);

/* Handlers */
const saveDraft = async () => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const transactionBytes = getTransactionBytes();
  if (!transactionBytes) return;

  if (route.query.draftId) {
    try {
      const loadedDraft = await getDraft(route.query.draftId.toString());

      if (getTransactionFromBytes(loadedDraft.transactionBytes).toBytes() != transactionBytes) {
        await updateDraft(loadedDraft.id, {
          transactionBytes: transactionBytes.toString(),
          description: props.description,
        });
        toast.success('Draft updated');
        props.handleDraftUpdated && props.handleDraftUpdated(loadedDraft.id);
      } else {
        await sendAddDraft(user.personal.id, transactionBytes);
      }
    } catch (error) {
      console.log(error);
    }
  } else {
    await sendAddDraft(user.personal.id, transactionBytes);
  }
};

const handleModalSaveDraftSubmit = () => {
  props.handleSaveDraft ? props.handleSaveDraft() : saveDraft();
  routeTo.value && router.push(routeTo.value);
};

/* Functions */
async function sendAddDraft(userId: string, transactionBytes: Uint8Array) {
  const { id } = await addDraft(userId, transactionBytes, props.description);
  props.handleDraftAdded && props.handleDraftAdded(id);
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

/* Hooks */
onBeforeRouteLeave(async to => {
  if (to.name?.toString().toLocaleLowerCase().includes('login')) return true;

  const transactionBytes = getTransactionBytes();
  if (!transactionBytes) return true;

  if (route.query.draftId) {
    try {
      const loadedDraft = await getDraft(route.query.draftId.toString());

      if (getTransactionFromBytes(loadedDraft.transactionBytes).toBytes() != transactionBytes) {
        await updateDraft(loadedDraft.id, {
          transactionBytes: transactionBytes.toString(),
          description: props.description,
        });
        props.handleDraftUpdated && props.handleDraftUpdated(loadedDraft.id);
      }
    } catch (error) {
      console.log(error);
    }
    return true;
  }

  if (!(await draftExists(transactionBytes)) && !isSaveDraftModalShown.value && !props.isExecuted) {
    isSaveDraftModalShown.value = true;
    routeTo.value = to;
    return false;
  } else {
    return true;
  }
});
</script>
<template>
  <div>
    <AppButton
      color="secondary"
      type="button"
      data-testid="button-save-draft"
      @click="() => (handleSaveDraft ? handleSaveDraft() : saveDraft())"
      v-bind="$attrs"
      ><i class="bi bi-save"></i> Save Draft</AppButton
    >
    <AppModal
      :show="isSaveDraftModalShown"
      :close-on-click-outside="false"
      :close-on-escape="false"
      class="small-modal"
    >
      <form class="text-center p-4" @submit.prevent="handleModalSaveDraftSubmit">
        <div class="text-start">
          <i class="bi bi-x-lg cursor-pointer" @click="isSaveDraftModalShown = false"></i>
        </div>
        <div>
          <AppCustomIcon :name="'lock'" style="height: 160px" />
        </div>
        <h2 class="text-title text-semi-bold mt-3">Save draft?</h2>
        <p class="text-small text-secondary mt-3">
          Pick up exactly where you left off, without compromising your flow or losing valuable
          time.
        </p>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton
            color="borderless"
            data-testid="button-discard-draft-modal"
            type="button"
            @click="routeTo && $router.push(routeTo)"
            >Discard</AppButton
          >
          <AppButton color="primary" data-testid="button-save-draft-modal" type="submit"
            >Save</AppButton
          >
        </div>
      </form>
    </AppModal>
  </div>
</template>
