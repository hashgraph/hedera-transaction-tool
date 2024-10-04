<script setup lang="ts">
import { ref, watch } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Types */
export type ModelValue = {
  recoveryPhrasePassword: string;
};

export type SubmitCallback = (
  value: ModelValue,
) => ({ error: string } | null) | Promise<{ error: string } | null>;

/* Props */
const props = defineProps<{
  loading: boolean;
  submitCallback: SubmitCallback;
}>();

/* State */
const inputRecoveryPhrasePassword = ref('');
const inputRecoveryPhrasePasswordError = ref<string | null>(null);

/* Handlers */
const handleOnFormSubmit = async (e: Event) => {
  e.preventDefault();

  const recoveryPhrasePassword = inputRecoveryPhrasePassword.value.trim();

  if (recoveryPhrasePassword.length === 0) return;

  const result = await props.submitCallback({ recoveryPhrasePassword });
  inputRecoveryPhrasePasswordError.value = result?.error || null;
};

/* Watchers */
watch(inputRecoveryPhrasePassword, () => (inputRecoveryPhrasePasswordError.value = null));
</script>
<template>
  <form @submit="handleOnFormSubmit" class="flex-column-100">
    <div class="fill-remaining">
      <p class="text-secondary text-small lh-base text-center">
        Enter password for decrypting the recovery phrase from the old tool
      </p>

      <!-- Mnemonic Password -->
      <div class="mt-5">
        <label data-testid="label-password" class="form-label"
          >Recovery Phrase Decryption Password</label
        >
        <AppInput
          v-model="inputRecoveryPhrasePassword"
          :filled="true"
          type="password"
          :class="{ 'is-invalid': inputRecoveryPhrasePasswordError }"
          placeholder="Enter recovery phrase decryption password"
          data-testid="input-recovery-phrase-decryption-password"
        />
        <div
          v-if="inputRecoveryPhrasePasswordError"
          data-testid="invalid-text-recovery-password"
          class="invalid-feedback"
        >
          {{ inputRecoveryPhrasePasswordError }}
        </div>
      </div>
    </div>

    <!-- Submit -->
    <div class="d-flex justify-content-end align-items-end mt-5">
      <div>
        <AppButton
          color="primary"
          type="submit"
          class="w-100"
          loading-text="Decrypting..."
          :loading="loading"
          :disabled="inputRecoveryPhrasePassword.length === 0"
          data-testid="button-decrypt-recovery-phrase"
          >Continue</AppButton
        >
      </div>
    </div>
  </form>
</template>
