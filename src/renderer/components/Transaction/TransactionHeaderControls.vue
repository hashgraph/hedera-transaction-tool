<script setup lang="ts">
import { ref } from 'vue';
import { RouteLocationNormalized, onBeforeRouteLeave } from 'vue-router';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRoute } from 'vue-router';

import {
  addDraft,
  draftExists,
  getDraft,
  updateDraft,
} from '@renderer/services/transactionDraftsService';

import { getTransactionFromBytes } from '@renderer/utils/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    handleSign?: () => void;
    handleSaveDraft?: () => void;
    getTransactionBytes?: () => Uint8Array;
    isExecuted?: boolean;
    createRequirements?: any;
    headingText?: string;
    buttonText?: string;
    buttonType?: string;
  }>(),
  {
    buttonText: 'Sign & Submit',
    buttonType: 'submit',
  },
);

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const route = useRoute();

/* State */
const routeTo = ref<RouteLocationNormalized | null>(null);
const isSaveDraftModalShown = ref(false);

/* Handlers */
const saveDraft = async () => {
  if (!props.getTransactionBytes) return;

  const transactionBytes = props.getTransactionBytes();

  await addDraft(user.data.id, transactionBytes);

  toast.success('Draft saved', { position: 'bottom-right' });
};

/* Hooks */
onBeforeRouteLeave(async to => {
  if (!props.getTransactionBytes) return true;

  const transactionBytes = props.getTransactionBytes();

  if (route.query.draftId) {
    const loadedDraft = await getDraft(route.query.draftId.toString());

    if (getTransactionFromBytes(loadedDraft.transactionBytes).toBytes() != transactionBytes) {
      await updateDraft(loadedDraft.id, transactionBytes);
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
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
    <h2 class="text-title text-bold">{{ headingText }}</h2>
    <div class="d-flex justify-content-end align-items-center">
      <AppButton
        color="secondary"
        :outline="true"
        type="button"
        @click="() => (handleSaveDraft ? handleSaveDraft() : saveDraft())"
        class="me-3"
        ><i class="bi bi-save"></i> Save Draft</AppButton
      >
      <AppButton
        color="primary"
        :type="buttonType"
        :disabled="createRequirements"
        @click="handleSign"
        >{{ buttonText }}</AppButton
      >
    </div>
    <AppModal
      :show="isSaveDraftModalShown"
      :close-on-click-outside="false"
      :close-on-escape="false"
      class="small-modal"
    >
      <div class="text-center p-4">
        <div class="text-start">
          <i class="bi bi-x-lg cursor-pointer" @click="isSaveDraftModalShown = false"></i>
        </div>
        <div>
          <img src="/images/draft.png" class="h-100" style="width: 200px" alt="draft" />
        </div>
        <h2 class="text-title text-semi-bold mt-3">Save draft?</h2>
        <p class="text-small text-secondary mt-3">
          Pick up exactly where you left off, without compromising your flow or losing valuable
          time.
        </p>
        <div class="row mt-5">
          <div class="col-6">
            <AppButton
              color="secondary"
              type="button"
              class="w-100"
              @click="routeTo && $router.push(routeTo)"
              >Cancel</AppButton
            >
          </div>
          <div class="col-6">
            <AppButton
              color="primary"
              type="button"
              class="w-100"
              @click="
                saveDraft();
                routeTo && $router.push(routeTo);
              "
              >Save</AppButton
            >
          </div>
        </div>
      </div>
    </AppModal>
  </div>
</template>
