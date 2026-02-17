<script setup lang="ts">
import { ref, watch } from 'vue';
import { Mnemonic } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useAccountSetupStore from '@renderer/stores/storeAccountSetup';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useRecoveryPhraseNickname from '@renderer/composables/useRecoveryPhraseNickname';

import { validateMnemonic } from '@renderer/services/keyPairService';

import { isLoggedInOrganization } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppRecoveryPhraseWord from '@renderer/components/ui/AppRecoveryPhraseWord.vue';
import RecoveryPhraseNicknameInput from '@renderer/components/RecoveryPhrase/RecoveryPhraseNicknameInput.vue';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
const props = defineProps<{
  handleNext: () => void;
}>();

/* Store */
const user = useUserStore();
const accountSetupStore = useAccountSetupStore();

/* Composables */
const router = useRouter();
const toast = useToast();
const recoveryPhraseNickname = useRecoveryPhraseNickname();

/* State */
const words = ref(Array(24).fill(''));
const correctWords = ref(Array(24).fill(''));
const indexesToVerify = ref<number[]>([]);

const checkboxChecked = ref(false);
const wordsConfirmed = ref(false);
const toVerify = ref(false);
const mnemonicHashNickname = ref('');

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
    await user.setRecoveryPhrase(words);
    wordsConfirmed.value = true;
  }
};

const handleWordChange = (newWord: string, index: number) => {
  words.value[index] = newWord;
  words.value = [...words.value];
};

const handleCopyRecoveryPhrase = () => {
  navigator.clipboard.writeText(words.value.join(', '));
  toast.success('Recovery phrase copied', successToastOptions);
};

const handleGenerate = async () => {
  if (user.recoveryPhrase === null) return;
  await recoveryPhraseNickname.set(user.recoveryPhrase.hash, mnemonicHashNickname.value);
  await props.handleNext();
};

const handleSkip = async () => {
  await accountSetupStore.handleSkipRecoveryPhrase();
  await router.push({ name: 'transactions' });
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
    <div class="row flex-wrap g-12px mx-0">
      <template v-for="(word, index) in words || []" :key="index">
        <AppRecoveryPhraseWord
          class="col-3"
          :word="word"
          :index="index + 1"
          :readonly="!indexesToVerify.includes(index)"
          :handle-word-change="newWord => handleWordChange(newWord, index)"
          visible-initially
          :verification="indexesToVerify.includes(index)"
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
        data-testid="checkbox-understand-backed-up"
      />
    </div>
  </div>

  <div
    class="row justify-content-center mt-5"
    v-if="!wordsConfirmed && !toVerify && words.filter(w => w).length === 0"
  >
    <div class="col-6">
      <AppButton
        v-if="isLoggedInOrganization(user.selectedOrganization)"
        color="secondary"
        class="w-100 mb-4"
        @click="handleSkip"
        data-testid="button-skip-generate"
      >
        <span>Skip</span>
      </AppButton>
      <AppButton
        :disabled="!checkboxChecked && words.filter(w => w).length === 0"
        color="primary"
        class="w-100"
        @click="handleGeneratePhrase"
        data-testid="button-next-generate"
      >
        <span>Generate</span>
      </AppButton>
    </div>
  </div>

  <div
    class="row justify-content-between mt-5"
    v-if="!wordsConfirmed && !toVerify && words.filter(w => w).length !== 0"
  >
    <div class="col-8">
      <div class="d-flex">
        <AppButton
          data-testid="button-generate-again"
          :disabled="!checkboxChecked && words.filter(w => w).length === 0"
          color="secondary"
          @click="handleGeneratePhrase"
        >
          <p><i class="bi bi-arrow-repeat"></i> Generate again</p>
        </AppButton>
        <AppButton
          v-if="words.filter(w => w).length !== 0"
          color="secondary"
          data-testid="button-copy"
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
        data-testid="button-verify"
        class="w-100"
        >Verify</AppButton
      >
    </div>
  </div>

  <template v-if="toVerify">
    <div class="form-group mt-4">
      <label class="form-label">Enter Recovery Phrase Nickname</label>
      <RecoveryPhraseNicknameInput
        v-model="mnemonicHashNickname"
        :mnemonic-hash="user.recoveryPhrase?.hash"
        :filled="true"
        data-testid="input-recovery-phrase-nickname"
      />
    </div>

    <div class="d-flex justify-content-between mt-5 mx-3">
      <div class="text-small align-self-center">Verify your Recovery Phrase</div>
      <div class="col-4">
        <AppButton
          data-testid="button-verify-next-generate"
          color="primary"
          class="w-100"
          :disabled="!wordsConfirmed"
          @click="handleGenerate"
          >Next</AppButton
        >
      </div>
    </div>
  </template>
</template>
