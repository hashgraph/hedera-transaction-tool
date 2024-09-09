<script setup lang="ts">
import { ref } from 'vue';

import SelectEncryptedKeysModal from '@renderer/components/KeyPair/ImportEncrypted/components/SelectEncryptedKeysModal.vue';

/* State */
const isSelectEncryptedKeysModalShown = ref(false);
const isRecoveryPhraseModalShown = ref(false);

const keyPaths = ref<string[] | null>(null);

/* Handlers */
const handleEncryptedKeysSelected = () => {
  if (keyPaths.value === null || keyPaths.value.length === 0) return;

  isSelectEncryptedKeysModalShown.value = false;
  isRecoveryPhraseModalShown.value = true;
};

/* Functions */
function process() {
  reset();
  isSelectEncryptedKeysModalShown.value = true;
}

function reset() {
  isSelectEncryptedKeysModalShown.value = false;
}

/* Expose */
defineExpose({ process });
</script>
<template>
  <div>
    <!-- Step #1: Select zip/folder -->
    <SelectEncryptedKeysModal
      v-model:key-paths="keyPaths"
      v-model:show="isSelectEncryptedKeysModalShown"
      @continue="handleEncryptedKeysSelected"
    />
  </div>
</template>
