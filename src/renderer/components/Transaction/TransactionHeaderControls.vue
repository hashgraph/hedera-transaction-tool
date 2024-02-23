<script setup lang="ts">
import { computed } from 'vue';

import { getTransactionType } from '@renderer/utils/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import { addDraft } from '@renderer/services/transactionDraftsService';

/* Props */
const props = withDefaults(
  defineProps<{
    handleSign?: () => void;
    handleSaveDraft?: () => void;
    createRequirements?: any;
    headingText?: string;
    buttonText?: string;
    buttonType?: string;
    transactionBytes?: Uint8Array;
  }>(),
  {
    buttonText: 'Sign & Submit',
    buttonType: 'submit',
  },
);

const type = computed(() => props.transactionBytes && getTransactionType(props.transactionBytes));

/* Handlers */
const saveDraft = () => {
  if (!props.transactionBytes || !type.value) return;

  addDraft(props.transactionBytes);
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
