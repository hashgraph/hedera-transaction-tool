<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';

import useKeyPairsStore from '../../../stores/storeKeyPairs';

import { hashRecoveryPhrase, validateMnemonic } from '../../../services/keyPairService';

import AppRecoveryPhraseWord from '../../../components/ui/AppRecoveryPhraseWord.vue';

/* Props */
const props = defineProps<{
  handleContinue: (words: string[]) => void;
  secretHashes: string[];
}>();

/* Stores */
const keyPairs = useKeyPairsStore();

/* State */
const words = ref(Array(24).fill(''));

const isMnenmonicValid = ref(false);
const isSecretHashValid = ref(true);

/* Misc Functions */
const validateMatchingSecretHash = async () => {
  if (!isMnenmonicValid.value) return;

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

/* Hooks */
onBeforeMount(() => {
  if (keyPairs.recoveryPhraseWords.length === 24) {
    words.value = keyPairs.recoveryPhraseWords;
  }
});

/* Watchers */
watch(words, async newWords => {
  isMnenmonicValid.value = await validateMnemonic(newWords);
  await validateMatchingSecretHash();

  if (isMnenmonicValid.value && isSecretHashValid.value) {
    return keyPairs.setRecoveryPhrase(words.value);
  }
  keyPairs.clearRecoveryPhrase();
});
</script>
<template>
  <div>
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
</template>
