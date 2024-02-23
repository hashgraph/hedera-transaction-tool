<script setup lang="ts">
import { ref } from 'vue';
import { RouteLocationNormalized, onBeforeRouteLeave } from 'vue-router';

import { useToast } from 'vue-toast-notification';

import { addDraft, draftExists } from '@renderer/services/transactionDraftsService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = withDefaults(
  defineProps<{
    handleSign?: () => void;
    handleSaveDraft?: () => void;
    getTransactionBytes?: () => Uint8Array;
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

/* Composables */
const toast = useToast();

/* State */
const routeTo = ref<RouteLocationNormalized | null>(null);
const isSaveDraftModalShown = ref(false);

/* Handlers */
const saveDraft = () => {
  if (!props.getTransactionBytes) return;

  const transactionBytes = props.getTransactionBytes();

  addDraft(transactionBytes);

  toast.success('Draft saved', { position: 'bottom-right' });
};

/* Hooks */
onBeforeRouteLeave(to => {
  if (!props.getTransactionBytes) return true;

  if (!draftExists(props.getTransactionBytes()) && !isSaveDraftModalShown.value) {
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
      class="common-modal"
    >
      <div class="text-center p-5">
        <div class="mt-3">
          <span class="bi bi-save large-icon"></span>
        </div>
        <h2 class="text-title text-semi-bold mt-5">Do you want to save a draft?</h2>
        <!-- <p class="text-small text-secondary mt-3"></p> -->
        <div class="row justify-content-between mt-5">
          <div class="col-5">
            <AppButton
              :outline="true"
              color="secondary"
              type="button"
              class="w-100"
              @click="routeTo && $router.push(routeTo)"
              >No</AppButton
            >
          </div>
          <div class="col-5">
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
