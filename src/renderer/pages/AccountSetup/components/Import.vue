<script setup lang="ts">
import { ref, watch } from 'vue';

import { useToast } from 'vue-toast-notification';

import { hashRecoveryPhrase, validateMnemonic } from '../../../services/keyPairService';

import AppButton from '../../../components/ui/AppButton.vue';
import AppRecoveryPhraseWord from '../../../components/ui/AppRecoveryPhraseWord.vue';

/* Props */
const props = defineProps<{
  handleContinue: (words: string[]) => void;
  secretHashes: string[];
}>();

/* Composables */
const toast = useToast();

/* State */
const words = ref(Array(24).fill(''));

const isMnenmonicValid = ref(false);
const isSecretHashValid = ref(true);

/* Misc Functions */
const validateMatchingSecretHash = async () => {
  const secretHash = await hashRecoveryPhrase(words.value);

  if (props.secretHashes.length > 0 && !props.secretHashes.includes(secretHash)) {
    isSecretHashValid.value = false;
    return;
  }

  isSecretHashValid.value = true;
};

/* Handlers */
const handlePaste = async (e: Event, index: number) => {
  e.preventDefault();

  const items = await navigator.clipboard.readText();

  const mnenmonic = items
    .split(/[\s,]+|,\s*|\n/)
    .filter(w => w)
    .slice(0, 24);

  const isValid = await validateMnemonic(mnenmonic);

  if (isValid && Array.isArray(mnenmonic)) {
    words.value = mnenmonic;

    await validateMatchingSecretHash();
  } else if (mnenmonic.length === 1) {
    words.value[index] = mnenmonic[0];
  }
};

const handleFinishImport = async () => {
  const isValid = await validateMnemonic(words.value);

  await validateMatchingSecretHash();

  if (isValid) {
    toast.success('Recovery Phrase Imported successfully', { position: 'bottom-right' });
    props.handleContinue(words.value);
  }
};

/* Watchers */
watch(words, async newWords => {
  isMnenmonicValid.value = await validateMnemonic(newWords);
});
</script>
<template>
  <div class="d-flex justify-content-center row">
    <div class="col-12 col-md-10 col-xl-8">
      <div class="d-flex flex-wrap row g-3">
        <template v-for="(word, index) in words || []" :key="index">
          <AppRecoveryPhraseWord
            class="col-3"
            :word="word"
            :index="index + 1"
            :handle-word-change="
              newWord => {
                words[index] = newWord;
                words = [...words];
              }
            "
            visible-initially
            @paste="handlePaste($event, index)"
          />
        </template>
      </div>
      <p v-if="!isSecretHashValid" class="mt-3 text-danger">Recovery phrase not match yours</p>
    </div>
  </div>

  <div class="w-100 d-flex justify-content-center gap-4 mt-8">
    <AppButton
      :disabled="!isMnenmonicValid || !isSecretHashValid"
      size="large"
      color="secondary"
      class="rounded-4 min-w-50"
      @click="handleFinishImport"
      >Continue</AppButton
    >
  </div>
</template>
