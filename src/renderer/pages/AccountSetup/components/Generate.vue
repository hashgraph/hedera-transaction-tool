<script setup lang="ts">
import { ref } from 'vue';

import { Mnemonic } from '@hashgraph/sdk';

import { downloadFileUnencrypted } from '../../../services/recoveryPhraseService';

import AppRecoveryPhraseWord from '../../../components/ui/AppRecoveryPhraseWord.vue';
import AppCheckBox from '../../../components/ui/AppCheckBox.vue';
import AppButton from '../../../components/ui/AppButton.vue';
import AppModal from '../../../components/ui/AppModal.vue';

defineProps<{
  handleContinue: (words: string[]) => void;
}>();

const words = ref(Array(24).fill(''));
const correctWords = ref(Array(24).fill(''));
const indexesToVerify = ref<number[]>([]);

const checkboxChecked = ref(false);
const wordsConfirmed = ref(false);
const toVerify = ref(false);
const isSuccessModalShown = ref(false);

const handleGeneratePhrase = async () => {
  if (words.value.filter(w => w).length === 0) {
    checkboxChecked.value = false;
  }

  const mnemonic = await Mnemonic.generate();

  words.value = mnemonic._mnemonic.words;
};

const handleCopyWords = () => {
  navigator.clipboard.writeText(words.value.toString());
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
    isSuccessModalShown.value = true;
  }
};

const handleDownloadRecoveryPhrase = () => {
  downloadFileUnencrypted(correctWords.value);
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
            :handle-word-change="
              newWord => {
                words[index] = newWord;
                words = [...words];
              }
            "
            visible-initially
          />
        </template>
      </div>
      <div v-if="words.filter(w => w).length > 0 && !toVerify" class="mt-5 text-center">
        <AppButton color="secondary" @click="handleCopyWords"
          ><i class="bi bi-copy me-2"></i> Copy</AppButton
        >
      </div>
      <div v-if="!toVerify" class="mt-5">
        <AppCheckBox
          v-model:checked="checkboxChecked"
          :label="
            words.filter(w => w).length > 0
              ? 'I have backed up my phrase somewhere safe.'
              : 'I understand that if i lose my recovery phrase, I will not be able to access my account.'
          "
          name="recoveryPhraseAgreement"
        />
      </div>
    </div>
  </div>
  <div class="w-100 d-flex justify-content-center gap-4 mt-8">
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
  <AppModal v-model:show="isSuccessModalShown" class="common-modal">
    <div class="p-5">
      <i class="bi bi-x-lg d-inline-block cursor-pointer" @click="isSuccessModalShown = false"></i>
      <div class="mt-5 text-center">
        <i class="bi bi-check-circle-fill extra-large-icon"></i>
      </div>
      <h3 class="mt-5 text-main text-center text-bold">Recovery Phrase Created successfully</h3>
      <AppButton
        color="primary"
        size="large"
        class="mt-5 w-100 rounded-4"
        @click="handleContinue(correctWords)"
        >Continue</AppButton
      >
      <AppButton
        color="secondary"
        size="large"
        class="mt-4 w-100 rounded-4"
        @click="handleDownloadRecoveryPhrase"
        >Download File</AppButton
      >
    </div>
  </AppModal>
</template>
