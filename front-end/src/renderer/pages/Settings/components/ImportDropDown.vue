<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';
import ImportExternalPrivateKeyModal from '@renderer/components/ImportExternalPrivateKeyModal.vue';

/* State */
const keyType = ref<'ED25519' | 'ECDSA'>('ED25519');
const isImportModalShown = ref(false);

/* Handlers */
const handleImportExternal = (type: 'ED25519' | 'ECDSA') => {
  keyType.value = type;
  isImportModalShown.value = true;
};
</script>
<template>
  <div class="dropdown">
    <AppButton
      color="primary"
      data-testid="button-restore-dropdown"
      class="w-100 min-w-unset d-flex align-items-center justify-content-center"
      data-bs-toggle="dropdown"
      ><i class="bi bi-plus text-main me-2"></i> Import</AppButton
    >
    <ul class="dropdown-menu w-100 mt-3">
      <li
        data-testid="link-import-ed25519-key"
        class="dropdown-item cursor-pointer"
        @click="handleImportExternal('ED25519')"
      >
        <span class="text-small">ED25519 Key</span>
      </li>
      <li
        data-testid="link-import-ecdsa-key"
        class="dropdown-item cursor-pointer mt-3"
        @click="handleImportExternal('ECDSA')"
      >
        <span class="text-small">ECDSA Key</span>
      </li>
    </ul>
  </div>
  <ImportExternalPrivateKeyModal
    class="min-w-unset"
    v-model:show="isImportModalShown"
    :key-type="keyType"
  />
</template>
