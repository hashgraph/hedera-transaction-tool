<script setup lang="ts">
import { ref } from 'vue';
import { Mnemonic } from '@hashgraph/sdk';

import { useToast } from 'vue-toast-notification';

import AppButton from '../../../components/ui/AppButton.vue';
import AppCheckBox from '../../../components/ui/AppCheckBox.vue';
import AppRecoveryPhraseWord from '../../../components/ui/AppRecoveryPhraseWord.vue';

/* Props */
const props = defineProps<{
  handleContinue: (words: string[]) => void;
}>();

/* Composables */
const toast = useToast();

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
};

const handleVerify = () => {
  if (words.value.toString() === correctWords.value.toString()) {
    toast.success('Recovery Phrase Created successfully', { position: 'bottom-right' });
    props.handleContinue(correctWords.value);
  }
};

const handleWordChange = (newWord: string, index: number) => {
  words[index] = newWord;
  words.value = [...words.value];
};
</script>
<template>
  <div class="d-flex justify-content-center row">
    <div class="col-12 col-md-10 col-xl-8">
      <div v-if="toVerify" class="text-center mb-8">
        <h1 class="text-main text-bold">Verify Recovery Phrase</h1>
        <h3 class="text-main mt-2">Enter the missing words</h3>
      </div>
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
  </div>
  <div class="d-flex flex-column justify-content-center align-items-center gap-4 mt-8">
    <AppButton
      v-if="!wordsConfirmed && !toVerify"
      :disabled="!checkboxChecked && words.filter(w => w).length === 0"
      size="large"
      color="primary"
      class="rounded-4 min-w-50"
      @click="handleGeneratePhrase"
    >
      <span v-if="words.filter(w => w).length === 0">Generate</span>
      <span v-else>Generate again</span>
    </AppButton>
    <AppButton
      v-if="words.filter(w => w).length > 0 && !toVerify"
      :disabled="!checkboxChecked"
      size="large"
      color="secondary"
      class="rounded-4 min-w-50"
      @click="handleProceedToVerification"
      >Continue</AppButton
    >
    <AppButton
      v-if="toVerify"
      :disabled="words.toString() !== correctWords.toString()"
      size="large"
      color="secondary"
      class="rounded-4 min-w-50"
      @click="handleVerify"
      >Verify</AppButton
    >
  </div>
</template>
