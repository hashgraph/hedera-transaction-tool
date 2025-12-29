<script setup lang="ts">
import AppModal from '@renderer/components/ui/AppModal.vue';
import CreateExternalSigningRequestButton from '@renderer/components/ExternalSigning/Request/CreateExternalSigningRequestButton.vue';
import ReviewExternalSigningRequestButton from '@renderer/components/ExternalSigning/Request/ReviewExternalSigningRequestButton.vue';
import ReviewExternalSigningResponseButton from '@renderer/components/ExternalSigning/Response/ReviewExternalSigningResponseButton.vue';

/* Models */
const show = defineModel<boolean>('show', { required: true });
</script>

<template>
  <AppModal v-model:show="show">
    <div class="p-5">
      <div class="d-flex align-items-center">
        <i class="bi bi-x-lg cursor-pointer me-5" @click="show = false" />
        <h3 class="text-subheader fw-medium flex-1">External Signing</h3>
      </div>
      <div class="d-flex flex-column justify-content-center m-5">
        <CreateExternalSigningRequestButton class="mb-4" />
        <ReviewExternalSigningRequestButton class="mb-4" />
        <ReviewExternalSigningResponseButton />
      </div>
    </div>
  </AppModal>
</template>
