<script setup lang="ts">
import { ref, watch } from 'vue';
import { Mnemonic } from '@hashgraph/sdk';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { validateMnemonic } from '@renderer/services/keyPairService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppRecoveryPhraseWord from '@renderer/components/ui/AppRecoveryPhraseWord.vue';

/* Props */
defineProps<{
  handleNext: () => void;
}>();

/* Store */
const keyPairs = useKeyPairsStore();

/* State */
const words = ref(Array(24).fill(''));
const correctWords = ref(Array(24).fill(''));
const indexesToVerify = ref<number[]>([]);

const checkboxChecked = ref(false);
const wordsConfirmed = ref(false);
const toVerify = ref(false);

/* Handlers */
const handleGeneratePhrase = async () => {
  if (words.value.filter(w => w).length === 0) {
    checkboxChecked.value = false;
  }

  const mnemonic = await Mnemonic.generate();

  words.value = mnemonic._mnemonic.words;
};

const handleProceedToVerification = () => {
  toVerify.value = true;

  correctWords.value = [...words.value];

  for (let i = 0; i < 5; i++) {
    const random = Math.floor(Math.random() * 24);

    if (indexesToVerify.value.includes(random)) {
      i--;
    } else {
      indexesToVerify.value.push(random);
    }
  }

  indexesToVerify.value.forEach(i => (words.value[i] = ''));
  words.value = [...words.value];
};

const handleSaveWords = async (words: string[]) => {
  const isValid = await validateMnemonic(words);

  if (!isValid) {
    throw new Error('Invalid Recovery Phrase!');
  } else {
    keyPairs.setRecoveryPhrase(words);
    wordsConfirmed.value = true;
  }
};

const handleWordChange = (newWord: string, index: number) => {
  words.value[index] = newWord;
  words.value = [...words.value];
};

const handleCopyRecoveryPhrase = () => {
  navigator.clipboard.writeText(words.value.join(', '));
};

/* Watchers */
watch(words, newWords => {
  if (newWords.toString() === correctWords.value.toString()) {
    handleSaveWords(correctWords.value);
  }
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
          :readonly="!indexesToVerify.includes(index)"
          :handle-word-change="newWord => handleWordChange(newWord, index)"
          visible-initially
        />
      </template>
    </div>
    <div v-if="!toVerify" class="mt-5">
      <AppCheckBox
        v-model:checked="checkboxChecked"
        :label="
          words.filter(w => w).length > 0
            ? 'I have backed up my phrase somewhere safe.'
            : 'I understand that if I lose my recovery phrase, I will not be able to create new keys or recover lost keys.'
        "
        name="recoveryPhraseAgreement"
      />
    </div>
  </div>

  <div
    class="row justify-content-center mt-6"
    v-if="!wordsConfirmed && !toVerify && words.filter(w => w).length === 0"
  >
    <div class="col-6">
      <AppButton
        :disabled="!checkboxChecked && words.filter(w => w).length === 0"
        color="primary"
        class="w-100"
        @click="handleGeneratePhrase"
      >
        <span>Generate</span>
      </AppButton>
    </div>
  </div>

  <div
    class="row justify-content-between mt-6"
    v-if="!wordsConfirmed && !toVerify && words.filter(w => w).length !== 0"
  >
    <div class="col-8">
      <div class="d-flex">
        <AppButton
          :disabled="!checkboxChecked && words.filter(w => w).length === 0"
          color="secondary"
          @click="handleGeneratePhrase"
        >
          <p><i class="bi bi-arrow-repeat"></i> Generate again</p>
        </AppButton>
        <AppButton
          v-if="words.filter(w => w).length !== 0"
          :outline="true"
          color="primary"
          @click="handleCopyRecoveryPhrase"
          class="ms-4"
          ><i class="bi bi-copy"></i> <span>Copy</span></AppButton
        >
      </div>
    </div>
    <div class="col-4">
      <AppButton
        :disabled="!checkboxChecked"
        color="primary"
        @click="handleProceedToVerification"
        class="w-100"
        >Verify</AppButton
      >
    </div>
  </div>

  <div v-if="wordsConfirmed" class="row justify-content-end mt-6">
    <div class="col-4">
      <AppButton color="primary" class="w-100" @click="handleNext">Next</AppButton>
    </div>
  </div>
</template>
