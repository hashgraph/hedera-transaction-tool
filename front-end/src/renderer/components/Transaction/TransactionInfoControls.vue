<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed, onMounted, ref } from 'vue';

import { getDraft } from '@renderer/services/transactionDraftsService';

import AppInput from '@renderer/components/ui/AppInput.vue';
import AppTextArea from '@renderer/components/ui/AppTextArea.vue';

/* Props */
defineProps<{
  name: string;
  description: string;
}>();

/* Emits */
const emit = defineEmits(['update:name', 'update:description']);

// /* Stores */
// const user = useUserStore();
//
/* Composables */
const route = useRoute();

/* Functions */
const loadFromDraft = async (id: string) => {
  const draft = await getDraft(id.toString());

  if (draft.name) {
    // name = draft.name;
  }

  if (draft.description) {
    // emit('update:maxTransactionFee', draftTransaction.maxTransactionFee);
  }
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
    <div class="form-group" :class="['col-4 col-xxxl-3']">
      <label class="form-label">Transaction Name</label>
      <AppInput
        :model-value="name"
        @update:model-value="v => $emit('update:name', v)"
        :filled="true"
        maxlength="50"
        placeholder="Enter a name for the transaction"
      />
    </div>
  </div>
  <div class="row">
    <div class="form-group" :class="['col-8 col-xxxl-6']">
      <label class="form-label">Transaction Description</label>
      <AppTextArea
        :model-value="description"
        @update:model-value="v => $emit('update:description', v)"
        :filled="true"
        :limit="256"
        placeholder="Enter a description for the transaction"
      />
    </div>
  </div>
</template>
