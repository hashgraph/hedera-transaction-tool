<script setup lang="ts">
import type { ModelValue, SubmitCallback } from './DecryptRecoveryPhraseForm.vue';
import type { RecoveryPhrase } from '@renderer/types';

import { ref } from 'vue';

import { decryptMigrationMnemonic } from '@renderer/services/migrateDataService';

import { createRecoveryPhrase, safeAwait } from '@renderer/utils';

import DecryptRecoveryPhraseForm from './DecryptRecoveryPhraseForm.vue';

/* Emits */
const emit = defineEmits<{
  (
    event: 'setRecoveryPhrase',
    value: { recoveryPhrase: RecoveryPhrase; recoveryPhrasePassword: string },
  ): void;
  (event: 'stopMigration'): void;
}>();

/* State */
const loading = ref(false);

/* Handlers */
const handleFormSubmit: SubmitCallback = async ({ recoveryPhrasePassword }: ModelValue) => {
  loading.value = true;
  const { error } = await safeAwait(decryptRecoveryPhrase(recoveryPhrasePassword));
  loading.value = false;

  if (error instanceof Error) return { error: error.message };
  return null;
};

const handleSkipDecrypt = () => {
  emit('setRecoveryPhrase', {
    recoveryPhrase: null,
    recoveryPhrasePassword: null,
  });
};

/* Functions */
const decryptRecoveryPhrase = async (recoveryPhrasePassword: string) => {
  const { data, error } = await safeAwait(decryptMigrationMnemonic(recoveryPhrasePassword));

  if (error || !data)
    throw new Error('Recovery phrase password is incorrect. Try a different password.');

  emit('setRecoveryPhrase', {
    recoveryPhrase: await createRecoveryPhrase(data),
    recoveryPhrasePassword,
  });
};
</script>
<template>
  <DecryptRecoveryPhraseForm
    :loading="loading"
    :submit-callback="handleFormSubmit"
    @skip-decrypt="handleSkipDecrypt"
    @stop-migration="$emit('stopMigration')"
  />
</template>
