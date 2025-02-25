<script setup lang="ts">
import { ref } from 'vue';

import ImportPublicKeyModal from '@renderer/components/ImportPublicKeyModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import UploadPublicKeysModal from '@renderer/components/UploadPublicKeysModal.vue';

/* State */
const isModalShown = ref(false);
const isUploadModalShown = ref(false);
</script>
<template>
  <div class="dropdown">
    <AppButton
      color="primary"
      data-testid="button-import-public-dropdown"
      class="min-w-unset d-flex align-items-center justify-content-center"
      data-bs-toggle="dropdown"
      ><i class="bi bi-plus text-main me-2"></i> Import
    </AppButton>
    <ul class="dropdown-menu mt-3">
      <li
        data-testid="import-single-public-key"
        class="dropdown-item cursor-pointer"
        @click="isModalShown = !isModalShown"
      >
        <span class="text-small">Single Key</span>
      </li>
      <li
        data-testid="import-file-public-key"
        class="dropdown-item cursor-pointer mt-3"
        @click="isUploadModalShown = !isUploadModalShown"
      >
        <span class="text-small">Upload File</span>
      </li>
    </ul>
  </div>

  <UploadPublicKeysModal class="min-w-unset" v-model:show="isUploadModalShown" />
  <ImportPublicKeyModal class="min-w-unset" v-model:show="isModalShown" />
</template>
