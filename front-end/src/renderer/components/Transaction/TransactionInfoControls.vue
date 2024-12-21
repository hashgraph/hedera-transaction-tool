<script setup lang="ts">
import { useRoute } from 'vue-router';
import { onMounted } from 'vue';

import { getDraft } from '@renderer/services/transactionDraftsService';

import AppTextArea from '@renderer/components/ui/AppTextArea.vue';

/* Props */
defineProps<{
  name: string;
  description: string;
}>();

/* Emits */
const emit = defineEmits(['update:description']);

/* Composables */
const route = useRoute();

/* Functions */
const loadFromDraft = async (id: string) => {
  const { description } = await getDraft(id.toString());
  if (description) emit('update:description', description);
};

/* Hooks */
onMounted(async () => {
  if (route.query.draftId) {
    await loadFromDraft(route.query.draftId.toString());
  }
});

/* Misc */
</script>
<template>
  <div class="row">
    <div class="form-group" :class="['col-11']">
      <label class="form-label">Transaction Description</label>
      <AppTextArea
        :model-value="description"
        @update:model-value="v => $emit('update:description', v)"
        :filled="true"
        :limit="256"
        placeholder="Enter a description for the transaction"
        data-testid="input-transaction-description"
      />
    </div>
  </div>
</template>
