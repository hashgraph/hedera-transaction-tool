<script setup lang="ts">
import { Mnemonic } from '@hashgraph/sdk';

import AppButton from '../../../components/ui/AppButton.vue';

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
      <AppButton color="primary" @click="handleGeneratePhrase">
        Regenerate Recovery Phrase
      </AppButton>
      <div>
        <AppButton color="primary" class="me-4" @click="handleDownloadRecoveryPhrase">
          Download file
        </AppButton>
        <AppButton color="secondary" @click="handleFinish">Finish</AppButton>
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
