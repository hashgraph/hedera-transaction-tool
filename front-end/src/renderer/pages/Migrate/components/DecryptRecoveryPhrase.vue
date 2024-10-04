<script setup lang="ts">
import type { ModelValue, SubmitCallback } from './DecryptRecoveryPhraseForm.vue';
import type { RecoveryPhrase } from '@renderer/types';

import { ref } from 'vue';

import { decryptMigrationMnemonic } from '@renderer/services/migrateDataService';

import { createRecoveryPhrase } from '@renderer/utils/userStoreHelpers';
import { safeAwait } from '@renderer/utils/safeAwait';

import DecryptRecoveryPhraseForm from './DecryptRecoveryPhraseForm.vue';

/* Emits */
const emit = defineEmits<{
  (event: 'setRecoveryPhrase', value: RecoveryPhrase): void;
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

/* Functions */
const decryptRecoveryPhrase = async (recoveryPhrasePassword: string) => {
  const { data, error } = await safeAwait(decryptMigrationMnemonic(recoveryPhrasePassword));

  if (error || !data)
    throw new Error('Mnemonic phrase decryption failed. Try a different password.');

  emit('setRecoveryPhrase', await createRecoveryPhrase(data));
};
</script>
<template>
  <DecryptRecoveryPhraseForm
    :loading="loading"
    :submit-callback="handleFormSubmit"
    @stop-migration="$emit('stopMigration')"
  />
</template>
