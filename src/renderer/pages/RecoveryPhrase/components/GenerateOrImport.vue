<script setup lang="ts">
import { Mnemonic } from '@hashgraph/sdk';

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
      <button
        type="button"
        class="btn btn-lg text-title btn-outline-primary me-4"
        @click="handleGeneratePhrase()"
      >
        Generate Recovery Phrase
      </button>
      <button
        type="button"
        class="btn btn-lg text-title btn-outline-secondary"
        @click="handleImportPhrase()"
      >
        Import Existing Phrase
      </button>
    </div>
  </div>
</template>
