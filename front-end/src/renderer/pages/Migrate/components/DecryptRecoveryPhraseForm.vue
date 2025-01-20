<script setup lang="ts">
import { ref, watch } from 'vue';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';

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

/* Emits */
defineEmits<{
  (event: 'stopMigration'): void;
}>();

/* State */
const inputRecoveryPhrasePassword = ref('');
const inputRecoveryPhrasePasswordError = ref<string | null>(null);

/* Handlers */
const handleOnFormSubmit = async () => {
  const recoveryPhrasePassword = inputRecoveryPhrasePassword.value.trim();

  if (recoveryPhrasePassword.length === 0) return;

  const result = await props.submitCallback({ recoveryPhrasePassword });
  inputRecoveryPhrasePasswordError.value = result?.error || null;
};

/* Watchers */
watch(inputRecoveryPhrasePassword, () => (inputRecoveryPhrasePasswordError.value = null));
</script>
<template>
  <form @submit.prevent="handleOnFormSubmit" class="flex-column-100">
    <div class="fill-remaining">
      <p class="text-secondary text-small lh-base text-center">
        Enter your recovery phrase password from the old tool
      </p>

      <!-- Mnemonic Password -->
      <div class="mt-5">
        <label data-testid="label-password" class="form-label">Recovery Phrase Password</label>
        <AppPasswordInput
          v-model="inputRecoveryPhrasePassword"
          :filled="true"
          :class="{ 'is-invalid': inputRecoveryPhrasePasswordError }"
          placeholder="Enter password"
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

    <div class="d-flex justify-content-between">
      <!-- Back -->
      <div class="d-flex justify-content-end align-items-end mt-5">
        <div>
          <AppButton
            color="secondary"
            type="button"
            class="w-100"
            data-testid="button-stop-migration"
            @click="$emit('stopMigration')"
            >Back</AppButton
          >
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
    </div>
  </form>
</template>
