<script setup lang="ts">
import { Mnemonic } from '@hashgraph/sdk';

import AppButton from '../../../components/ui/AppButton.vue';

defineProps<{
  step: number;
  recoveryPhrase: string[] | null;
  type: 'generate' | 'import' | '';
}>();
const emit = defineEmits(['update:step', 'update:recoveryPhrase', 'update:type']);

const handleGeneratePhrase = async () => {
  const mnemonic = await Mnemonic.generate();

  emit('update:recoveryPhrase', mnemonic._mnemonic.words);
  emit('update:step', 2);
  emit('update:type', 'generate');
};
const handleImportPhrase = () => {
  emit('update:recoveryPhrase', null);
  emit('update:step', 2);
  emit('update:type', 'import');
};
</script>
<template>
  <div class="h-100 d-flex flex-column justify-content-center align-items-center">
    <h1 class="text-display text-bold text-center">Recovery Phrase</h1>
    <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <AppButton
          color="primary"
          size="large"
          class="w-100 text-title rounded-4"
          @click="handleGeneratePhrase()"
        >
          Generate New Recovery Phrase
        </AppButton>
      </div>
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <AppButton
          color="secondary"
          size="large"
          class="w-100 text-title rounded-4"
          @click="handleImportPhrase()"
        >
          Import Existing Phrase
        </AppButton>
      </div>
    </div>
  </div>
</template>
