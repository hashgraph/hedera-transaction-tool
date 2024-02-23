<script setup lang="ts">
import { useToast } from 'vue-toast-notification';

import { addDraft } from '@renderer/services/transactionDraftsService';

import AppButton from '@renderer/components/ui/AppButton.vue';

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

/* Handlers */
const saveDraft = () => {
  if (!props.getTransactionBytes) return;

  const transactionBytes = props.getTransactionBytes();

  addDraft(transactionBytes);

  toast.success('Draft saved', { position: 'bottom-right' });
};
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
  </div>
</template>
