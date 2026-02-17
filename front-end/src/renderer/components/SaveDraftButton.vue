<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

import { redirectToPreviousTransactionsTab } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';

/* Props */
const props = defineProps<{
  description: string;
  saveDraft: () => Promise<void>;
  isExecuted: boolean;
}>();

/* Composables */
const route = useRoute();
const router = useRouter();

/* Handlers */
const handleDraft = async () => {
  await props.saveDraft();
  await redirectToPreviousTransactionsTab(router);
};
</script>
<template>
  <div>
    <AppButton
      color="secondary"
      type="button"
      data-testid="button-save-draft"
      @click="() => handleDraft()"
      v-bind="$attrs"
      ><i class="bi bi-save"></i>
      {{ Boolean(route.query.draftId) ? 'Update Draft' : 'Save Draft' }}</AppButton
    >
  </div>
</template>
