<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';
import ImportExternalPrivateKeyModal from '@renderer/components/ImportExternalPrivateKeyModal.vue';
import ImportEncrypted from '@renderer/components/KeyPair/ImportEncrypted';

/* State */
const importEncryptedRef = ref<InstanceType<typeof ImportEncrypted> | null>(null);
const keyType = ref<'ED25519' | 'ECDSA'>('ED25519');
const isImportExternalModalShown = ref(false);

/* Handlers */
const handleImportExternal = (type: 'ED25519' | 'ECDSA') => {
  keyType.value = type;
  isImportExternalModalShown.value = true;
};

const handleImportEncrypted = () => importEncryptedRef.value?.process();
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
      <li
        data-testid="link-import-encrypted-key"
        class="dropdown-item cursor-pointer mt-3"
        @click="handleImportEncrypted"
      >
        <span class="text-small">Encrypted keys</span>
      </li>
    </ul>
  </div>
  <ImportExternalPrivateKeyModal
    class="min-w-unset"
    v-model:show="isImportExternalModalShown"
    :key-type="keyType"
  />
  <ImportEncrypted ref="importEncryptedRef" />
</template>
