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
  <div class="h-100">
    <h1 class="text-huge text-bold text-center">Recovery Phrase</h1>
    <div class="h-50 d-flex justify-content-center align-items-center flex-wrap">
      <AppButton
        color="primary"
        size="large"
        class="text-title me-4"
        @click="handleGeneratePhrase()"
      >
        Generate Recovery Phrase
      </AppButton>
      <AppButton color="secondary" size="large" class="text-title" @click="handleImportPhrase()">
        Import Existing Phrase
      </AppButton>
    </div>
  </div>
</template>
