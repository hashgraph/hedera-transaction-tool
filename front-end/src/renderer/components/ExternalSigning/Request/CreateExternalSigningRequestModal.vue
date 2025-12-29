<script setup lang="ts">
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { ref } from 'vue';
import type { V1ImportCandidate } from '@shared/interfaces';

/* Models */
const show = defineModel<boolean>('show', { required: true });

/* State */
const selectedCandidates = ref<V1ImportCandidate[]>([]);
const generating = ref(false);

/* Handlers */
const handleSubmit = async () => {
  generating.value = true;
  try {
    await generateRequestFile();
  } finally {
    generating.value = false;
    show.value = false;
  }
};

/* Functions */
const generateRequestFile = async () => {
  // To be implemented
};
</script>

<template>
  <AppModal v-model:show="show" class="large-modal">
    <div class="p-5">
      <div class="d-flex align-items-center">
        <i class="bi bi-x-lg cursor-pointer me-5" @click="show = false" />
        <h3 class="text-subheader fw-medium flex-1">Select transactions to be signed externally</h3>
      </div>
      <form @submit.prevent="handleSubmit">
        <div class="d-flex justify-content-end mt-4">
          <AppButton
            data-testid="button-import-files-public"
            :disabled="selectedCandidates.length === 0"
            :loading="generating"
            loading-text="Generating…"
            type="submit"
            color="primary"
            >Generate Request File</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>

<style scoped></style>
