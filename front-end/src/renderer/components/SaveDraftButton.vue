<script setup lang="ts">
import { ref } from 'vue';
import { RouteLocationNormalized, onBeforeRouteLeave } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRoute, useRouter } from 'vue-router';

import {
  addDraft,
  draftExists,
  getDraft,
  updateDraft,
} from '@renderer/services/transactionDraftsService';

import { getTransactionFromBytes } from '@renderer/utils/transactions';
import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Props */
const props = defineProps<{
  handleSaveDraft?: () => void;
  handleDraftAdded?: (id: string) => void;
  handleDraftUpdated?: (id: string) => void;
  getTransactionBytes?: () => Uint8Array;
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
  if (!props.getTransactionBytes) return;
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const transactionBytes = props.getTransactionBytes();

  const { id } = await addDraft(user.personal.id, transactionBytes);
  props.handleDraftAdded && props.handleDraftAdded(id);

  toast.success('Draft saved', { position: 'bottom-right' });
};

const handleModalSaveDraftSubmit = (e: Event) => {
  e.preventDefault();

  props.handleSaveDraft ? props.handleSaveDraft() : saveDraft();
  routeTo.value && router.push(routeTo.value);
};

/* Hooks */
onBeforeRouteLeave(async to => {
  if (!props.getTransactionBytes || to.name?.toString().toLocaleLowerCase().includes('login'))
    return true;

  const transactionBytes = props.getTransactionBytes();

  if (route.query.draftId) {
    try {
      const loadedDraft = await getDraft(route.query.draftId.toString());

      if (getTransactionFromBytes(loadedDraft.transactionBytes).toBytes() != transactionBytes) {
        await updateDraft(loadedDraft.id, { transactionBytes: transactionBytes.toString() });
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
      <form class="text-center p-4" @submit="handleModalSaveDraftSubmit">
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
          <AppButton color="borderless" type="button" @click="routeTo && $router.push(routeTo)"
            >Discard</AppButton
          >
          <AppButton color="primary" type="submit">Save</AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
