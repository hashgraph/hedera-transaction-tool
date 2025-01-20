<script setup lang="ts">
import type { Prisma } from '@prisma/client';
import type { RecoveryPhrase } from '@renderer/types';
import type { ModelValue } from './SetupPersonalForm.vue';

import { ref } from 'vue';

import { getStaticUser, initializeUseKeychain } from '@renderer/services/safeStorageService';
import { registerLocal } from '@renderer/services/userService';
import { restorePrivateKey, storeKeyPair } from '@renderer/services/keyPairService';

import { safeAwait } from '@renderer/utils';

import SetupPersonalForm from './SetupPersonalForm.vue';

/* Types */
export type PersonalUser = { personalId: string } & (
  | {
      useKeychain: true;
      email: null;
      password: null;
    }
  | {
      useKeychain: false;
      email: string;
      password: string;
    }
);

/* Props */
const props = defineProps<{
  recoveryPhrase: RecoveryPhrase;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'setPersonalUser', personalUser: PersonalUser): void;
  (event: 'migration:cancel'): void;
}>();

/* State */
const loading = ref(false);

/* Handlers */
const handleFormSubmit = async (formData: ModelValue) => {
  loading.value = true;
  const { data, error } = await safeAwait(setupPersonal(formData));
  loading.value = false;

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('(BUG) Personal id not set');
  }

  emit('setPersonalUser', data);
};

const handleCancel = () => emit('migration:cancel');

/* Functions */
const setupPersonal = async ({
  useKeychain,
  email,
  password,
}: ModelValue): Promise<PersonalUser> => {
  /* Initialize the use of the keychain */
  await initializeUseKeychain(useKeychain);

  /* Register the user */
  const personalId = useKeychain
    ? (await getStaticUser()).id
    : (await registerLocal(email, password, true)).id;

  /* Restore first key pair */
  if (!props.recoveryPhrase) throw new Error('(BUG) Recovery phrase not set');
  const passphrase = '';
  const index = 0;
  const type = 'ED25519';
  const restoredPrivateKey = await restorePrivateKey(
    props.recoveryPhrase.words,
    passphrase,
    index,
    type,
  );

  /* Store the key pair */
  const keyPair: Prisma.KeyPairUncheckedCreateInput = {
    user_id: personalId,
    index,
    public_key: restoredPrivateKey.publicKey.toStringRaw(),
    private_key: restoredPrivateKey.toStringRaw(),
    type,
    organization_id: null,
    organization_user_id: null,
    secret_hash: props.recoveryPhrase.hash,
    nickname: null,
  };
  await storeKeyPair(keyPair, !useKeychain ? password : null, false);

  if (useKeychain) {
    return {
      personalId,
      useKeychain: true,
      email: null,
      password: null,
    };
  } else {
    return {
      personalId,
      useKeychain: false,
      email,
      password,
    };
  }
};
</script>
<template>
  <SetupPersonalForm
    :loading="loading"
    @submit.prevent="handleFormSubmit"
    @migration:cancel="handleCancel"
  />
</template>
