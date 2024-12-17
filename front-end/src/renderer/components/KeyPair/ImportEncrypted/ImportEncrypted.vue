<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import SelectEncryptedKeysModal from '@renderer/components/KeyPair/ImportEncrypted/components/SelectEncryptedKeysModal.vue';
import RecoveryPhraseModal from '@renderer/components/KeyPair/ImportEncrypted/components/RecoveryPhraseModal.vue';
import DecryptKeys from '@renderer/components/KeyPair/ImportEncrypted/components/DecryptKeys.vue';

/* Stores */
const user = useUserStore();

/* State */
const decryptKeysRef = ref<InstanceType<typeof DecryptKeys> | null>(null);

const isSelectEncryptedKeysModalShown = ref(false);
const isRecoveryPhraseModalShown = ref(false);

const keyPaths = ref<string[] | null>(null);

/* Handlers */
const handleEncryptedKeysSelected = () => {
  if (keyPaths.value === null || keyPaths.value.length === 0) return;

  isSelectEncryptedKeysModalShown.value = false;

  isRecoveryPhraseModalShown.value = true;
};

const handleRecoveryPhraseContinue = async () => {
  isRecoveryPhraseModalShown.value = false;
  await decryptKeysRef.value?.process(keyPaths.value || [], user.recoveryPhrase?.words || null);
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

    <!-- Step #2 (Optional): Recovery phrase  -->
    <RecoveryPhraseModal
      v-model:show="isRecoveryPhraseModalShown"
      @continue="handleRecoveryPhraseContinue"
    />

    <!-- Step #3: Decrypt Keys -->
    <DecryptKeys ref="decryptKeysRef" />
  </div>
</template>
