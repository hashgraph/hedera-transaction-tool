<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import Import from '@renderer/components/RecoveryPhrase/Import.vue';
import RecoveryPhraseNicknameInput from '@renderer/components/RecoveryPhrase/RecoveryPhraseNicknameInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

const user = useUserStore();

/* Emits */
const emit = defineEmits<{
  (event: 'next', nickname: string): void;
  (event: 'clear'): void;
}>();

/* State */
const mnemonicHashNickname = ref('');
const shouldClearInputs = ref(false);

/* Handlers */
const handleImportRecoveryPhrase = () => {
  emit('next', mnemonicHashNickname.value);
};

const handleClearWords = (value: boolean) => {
  shouldClearInputs.value = value;
  emit('clear');
};
</script>
<template>
  <form @submit.prevent="handleImportRecoveryPhrase" class="fill-remaining">
    <h1 class="text-display text-bold text-center">Enter your Recovery Phrase</h1>
    <div class="mt-8">
      <Import :should-clear="shouldClearInputs" @reset-cleared="handleClearWords($event)" />
      <div class="form-group mt-4">
        <label class="form-label">Enter Recovery Phrase Nickname</label>
        <RecoveryPhraseNicknameInput
          v-model="mnemonicHashNickname"
          :mnemonic-hash="user.recoveryPhrase?.hash"
          :filled="true"
          data-testid="input-recovery-phrase-nickname"
        />
      </div>
      <div class="row justify-content-between mt-6">
        <div class="col-4 d-grid">
          <AppButton type="button" color="secondary" @click="handleClearWords(true)"
            >Clear</AppButton
          >
        </div>
        <div class="col-4 d-grid">
          <AppButton
            color="primary"
            data-testid="button-continue-phrase"
            type="submit"
            :disabled="!user.recoveryPhrase"
          >
            Continue
          </AppButton>
        </div>
      </div>
    </div>
  </form>
</template>
