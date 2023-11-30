<script setup lang="ts">
import { Mnemonic } from '@hashgraph/sdk';

import { downloadFileUnencrypted } from '../../../services/recoveryPhraseService';

const props = defineProps<{
  recoveryPhrase: string[] | null;
  handleFinish: () => void;
}>();
const emit = defineEmits(['update:recoveryPhrase']);

const handleGeneratePhrase = async () => {
  const mnemonic = await Mnemonic.generate();

  emit('update:recoveryPhrase', mnemonic._mnemonic.words);
};

const handleDownloadRecoveryPhrase = () => {
  downloadFileUnencrypted(props.recoveryPhrase || []);
};
</script>
<template>
  <div>
    <div class="d-flex justify-content-between">
      <button type="button" class="btn btn-outline-primary" @click="handleGeneratePhrase">
        Regenerate Recovery Phrase
      </button>
      <div>
        <button type="button" class="btn btn-primary me-4" @click="handleDownloadRecoveryPhrase">
          Download file
        </button>
        <button type="button" class="btn btn-secondary" @click="handleFinish">Finish</button>
      </div>
    </div>
    <div class="mt-6 d-flex align-items-center justify-content-around flex-wrap gap-4">
      <div
        v-for="(word, index) in recoveryPhrase || []"
        :key="index"
        class="col-3 px-5 py-4 bg-info border-main-gradient text-center"
      >
        {{ word }}
      </div>
    </div>
  </div>
</template>
