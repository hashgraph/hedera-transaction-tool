<script setup lang="ts">
import {onBeforeMount, ref, watch} from 'vue';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import {hashRecoveryPhrase, validateMnemonic} from '@renderer/services/keyPairService';

import AppRecoveryPhraseWord from '@renderer/components/ui/AppRecoveryPhraseWord.vue';

/* Props */
const props = defineProps<{
  secretHashes: string[];
}>();

/* Stores */
const keyPairs = useKeyPairsStore();

/* State */
const words = ref<string[]>(Array(24).fill(''));

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
const handleWordChange = (newWord: string, index: number) => {
  words.value[index] = newWord.toLocaleLowerCase();
  words.value = [...words.value];
};

const handlePaste = async (e: Event, index: number) => {
  e.preventDefault();

  const items = await navigator.clipboard.readText();

  const mnenmonic = items
    .toLocaleLowerCase()
    .split(/[\s,]+|,\s*|\n/)
    .filter(w => w)
    .slice(0, 24);

  const isValid = await validateMnemonic(mnenmonic);

  if (isValid && Array.isArray(mnenmonic)) {
    words.value = mnenmonic;

    await validateMatchingSecretHash();
  } else if (mnenmonic.length === 1) {
    handleWordChange(mnenmonic[0], index);
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
  isMnenmonicValid.value = await validateMnemonic(newWords.map(w => w.toLocaleLowerCase()));
  await validateMatchingSecretHash();

  if (isMnenmonicValid.value && isSecretHashValid.value) {
    return keyPairs.setRecoveryPhrase(words.value.map(w => w.toLocaleLowerCase()));
  }
  keyPairs.clearRecoveryPhrase();
});
</script>
<template>
  <div>
    <div class="d-flex flex-wrap row g-3">
      <template
        v-for="(word, index) in words || []"
        :key="index"
      >
        <AppRecoveryPhraseWord
          class="col-3"
          :word="word"
          :index="index + 1"
          :handle-word-change="newWord => handleWordChange(newWord, index)"
          visible-initially
          @paste="handlePaste($event, index)"
        />
      </template>
    </div>
    <p
      v-if="!isSecretHashValid"
      class="mt-3 text-danger"
    >
      Recovery phrase not match yours
    </p>
  </div>
</template>
