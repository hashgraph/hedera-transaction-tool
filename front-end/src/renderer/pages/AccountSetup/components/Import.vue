<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { validateMnemonic } from '@renderer/services/keyPairService';
import { compareDataToHashes } from '@renderer/services/electronUtilsService';

import AppRecoveryPhraseWord from '@renderer/components/ui/AppRecoveryPhraseWord.vue';

/* Props */
const props = defineProps<{
  secretHashes: string[];
}>();

/* Stores */
const user = useUserStore();

/* State */
const words = ref<string[]>(Array(24).fill(''));

const isMnemonicValid = ref(false);
const isSecretHashValid = ref(true);

/* Misc Functions */
const validateMatchingSecretHash = async () => {
  if (!isMnemonicValid.value) return;

  if (props.secretHashes.length > 0) {
    const matchedHash = await compareDataToHashes(words.value.toString(), props.secretHashes);
    isSecretHashValid.value = Boolean(matchedHash);
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

  const mnemonic = items
    .toLocaleLowerCase()
    .split(/[\s,]+|,\s*|\n/)
    .filter(w => w)
    .slice(0, 24);

  const isValid = await validateMnemonic(mnemonic);

  if (isValid && Array.isArray(mnemonic)) {
    words.value = mnemonic;

    await validateMatchingSecretHash();
  } else if (mnemonic.length === 1) {
    handleWordChange(mnemonic[0], index);
  }
};

const handleClearWords = () => {
  words.value = Array(24).fill('');
};

/* Hooks */
onBeforeMount(() => {
  if (user.recoveryPhrase) {
    words.value = user.recoveryPhrase.words;
  }
});

/* Watchers */
watch(words, async newWords => {
  isMnemonicValid.value = await validateMnemonic(newWords.map(w => w.toLocaleLowerCase()));
  await validateMatchingSecretHash();

  if (isMnemonicValid.value && isSecretHashValid.value) {
    return await user.setRecoveryPhrase(words.value.map(w => w.toLocaleLowerCase()));
  }
  user.recoveryPhrase = null;
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
          @paste="handlePaste($event, index)"
        />
      </template>
    </div>
    <p v-if="!isSecretHashValid" class="mt-3 text-danger">Recovery phrase not match yours</p>
  </div>
</template>
