<script setup lang="ts">
import { Mnemonic } from '@hashgraph/sdk';

import AppButton from '../../../components/ui/AppButton.vue';

import { downloadFileUnencrypted } from '../../../services/recoveryPhraseService';
import AppRecoveryPhraseWord from '../../../components/ui/AppRecoveryPhraseWord.vue';

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
  <div class="d-flex flex-column justify-content-center align-items-center">
    <h1 class="text-display text-bold text-center">Recovery Phrase Created</h1>
    <p class="text-main mt-5 text-center">Copy/Download The Recovery Phrase</p>
    <div class="mt-4 col-12 col-md-8 col-xxl-6 row g-4">
      <template v-for="(word, index) in recoveryPhrase || []" :key="index">
        <AppRecoveryPhraseWord class="col-3" :word="word" />
      </template>
    </div>
    <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center">
      <div class="col-12 col-md-6 col-lg-4 col-xxl-2">
        <AppButton
          size="large"
          color="primary"
          class="w-100 rounded-4"
          @click="handleGeneratePhrase"
        >
          Generate again
        </AppButton>
        <AppButton
          size="large"
          color="primary"
          class="mt-4 w-100 rounded-4 d-flex justify-content-center align-items-center"
          @click="handleDownloadRecoveryPhrase"
        >
          Download file <i class="bi bi-download ms-2 text-headline" style="line-height: 24px"></i>
        </AppButton>
        <AppButton size="large" color="secondary" class="mt-4 w-100 rounded-4" @click="handleFinish"
          >Continue</AppButton
        >
      </div>
    </div>
  </div>
</template>
