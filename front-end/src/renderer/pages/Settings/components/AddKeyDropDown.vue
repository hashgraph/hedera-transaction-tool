<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';
import GenerateKeyModal from '@renderer/components/GenerateKeyModal.vue';
import RecoveryPhraseKeyModal from '@renderer/components/RecoveryPhraseKeyModal.vue';
import ImportExternalPrivateKeyModal from '@renderer/components/ImportExternalPrivateKeyModal.vue';
import ImportEncrypted from '@renderer/components/KeyPair/ImportEncrypted';

/* State */
const importEncryptedRef = ref<InstanceType<typeof ImportEncrypted> | null>(null);
const isGenerateKeyModalShown = ref(false);
const isRecoveryPhraseModalShown = ref(false);
const isImportExternalModalShown = ref(false);

/* Handlers */
const handleGenerateKey = () => {
  isGenerateKeyModalShown.value = true;
};

const handleImportExternal = () => {
  isImportExternalModalShown.value = true;
};

const handleImportEncrypted = () => importEncryptedRef.value?.process();

const handleRecoveryPhrase = () => {
  isRecoveryPhraseModalShown.value = true;
};
</script>
<template>
  <div class="dropdown">
    <AppButton
      color="primary"
      data-testid="button-add-key-dropdown"
      class="min-w-unset d-flex align-items-center justify-content-center"
      data-bs-toggle="dropdown"
      ><i class="bi bi-plus text-main me-2"></i> Add Key</AppButton
    >
    <ul class="dropdown-menu mt-3">
      <li
        data-testid="link-generate-key"
        class="dropdown-item cursor-pointer"
        @click="handleGenerateKey"
      >
        <span class="text-small">Generate</span>
      </li>
      <li
        data-testid="link-recovery-phrase"
        class="dropdown-item cursor-pointer mt-3"
        @click="handleRecoveryPhrase"
      >
        <span class="text-small">Recovery Phrase</span>
      </li>
      <li
        data-testid="link-import-private-key"
        class="dropdown-item cursor-pointer mt-3"
        @click="handleImportExternal"
      >
        <span class="text-small">Import Private Key</span>
      </li>
      <li
        data-testid="link-import-encrypted-key"
        class="dropdown-item cursor-pointer mt-3"
        @click="handleImportEncrypted"
      >
        <span class="text-small">Import Encrypted Keys</span>
      </li>
    </ul>
  </div>
  <GenerateKeyModal v-model:show="isGenerateKeyModalShown" />
  <RecoveryPhraseKeyModal v-model:show="isRecoveryPhraseModalShown" />
  <ImportExternalPrivateKeyModal v-model:show="isImportExternalModalShown" />
  <ImportEncrypted ref="importEncryptedRef" />
</template>
