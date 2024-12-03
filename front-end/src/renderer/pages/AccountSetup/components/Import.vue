<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { validateMnemonic } from '@renderer/services/keyPairService';

import AppRecoveryPhraseWord from '@renderer/components/ui/AppRecoveryPhraseWord.vue';

/* Constants */
const WORD_COUNT = 24;
const getDefaultWords = () => Array(WORD_COUNT).fill('');

/* Stores */
const user = useUserStore();

/* State */
const words = ref<string[]>(getDefaultWords());

const isMnemonicValid = ref(false);

/* Handlers */
const handleWordChange = (newWord: string, index: number) => {
  words.value[index] = newWord.toLocaleLowerCase();
  words.value = [...words.value];
};

const handlePaste = async (index: number) => {
  const items = await navigator.clipboard.readText();

  const mnemonic = items
    .toLocaleLowerCase()
    .split(/[\s,]+|,\s*|\n/)
    .filter(w => w)
    .slice(0, WORD_COUNT);

  const isValid = await validateMnemonic(mnemonic);
  if (isValid && Array.isArray(mnemonic)) {
    words.value = mnemonic;
  } else if (mnemonic.length === 1) {
    handleWordChange(mnemonic[0], index);
  }
};

const handleClearWords = () => {
  words.value = getDefaultWords();
};

/* Hooks */
onBeforeMount(() => {
  if (user.recoveryPhrase) {
    words.value = user.recoveryPhrase.words;
  }
});

/* Watchers */
watch(words, async newWords => {
  const normalizedWords = newWords.map(w => w.toLocaleLowerCase());
  isMnemonicValid.value = await validateMnemonic(normalizedWords);

  if (isMnemonicValid.value) {
    await user.setRecoveryPhrase(normalizedWords);
  } else {
    user.recoveryPhrase = null;
  }
});

/* Exposes */
defineExpose({
  clearWords: handleClearWords,
});
</script>
<template>
  <div>
    <div class="row flex-wrap g-12px mx-0">
      <template v-for="(word, index) in words || []" :key="index">
        <AppRecoveryPhraseWord
          class="col-3"
          :word="word"
          :index="index + 1"
          :handle-word-change="newWord => handleWordChange(newWord, index)"
          visible-initially
          @paste.prevent="handlePaste(index)"
        />
      </template>
    </div>
  </div>
</template>
