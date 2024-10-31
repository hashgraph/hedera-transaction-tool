<script setup lang="ts">
import type { Prisma } from '@prisma/client';
import type { RecoveryPhrase } from '@renderer/types';
import type { PersonalUser } from './SetupPersonal.vue';
import type { ModelValue, SubmitCallback } from './SetupOrganizationForm.vue';

import { ref } from 'vue';

import { addOrganization } from '@renderer/services/organizationsService';
import {
  changePassword,
  deleteKey,
  getUserState,
  login,
  uploadKey,
} from '@renderer/services/organization';
import { addOrganizationCredentials } from '@renderer/services/organizationCredentials';
import { restorePrivateKey, storeKeyPair } from '@renderer/services/keyPairService';
import { compareHash } from '@renderer/services/electronUtilsService';

import { userKeyHasMnemonic, safeAwait, toggleAuthTokenInSessionStorage } from '@renderer/utils';

import SetupOrganizationForm from './SetupOrganizationForm.vue';

/* Props */
const props = defineProps<{
  recoveryPhrase: RecoveryPhrase;
  personalUser: PersonalUser;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'setOrganizationId', value: string): void;
}>();

/* State */
const loading = ref(false);
const loadingText = ref<string>('');
const organizationId = ref<string | null>(null);
const organizationUserId = ref<number | null>(null);
const organizationJwtToken = ref<string | null>(null);
const loggedIn = ref(false);

/* Handlers */
const handleFormSubmit: SubmitCallback = async (formData: ModelValue) => {
  loading.value = true;

  /* Add Organization */
  if (!organizationId.value) {
    loadingText.value = 'Adding Organization...';
    const setupOrganizationResult = await safeAwait(setupOrganization(formData));
    if ('error' in setupOrganizationResult) {
      loading.value = false;
      throw setupOrganizationResult.error;
    }
    organizationId.value = setupOrganizationResult.data;
  }

  /* Login in Organization */
  if (!loggedIn.value) {
    loadingText.value = 'Logging in Organization...';
    const loginInOrganizationResult = await safeAwait(loginInOrganization(formData));
    if (loginInOrganizationResult.error instanceof Error) {
      loading.value = false;
      return { tempPasswordError: loginInOrganizationResult.error.message, newPasswordError: null };
    }
    loggedIn.value = true;
  }

  /* Set New Password */
  loadingText.value = 'Setting New Password...';
  const setNewPasswordResult = await safeAwait(setNewPassword(formData));
  if (setNewPasswordResult.error instanceof Error) {
    loading.value = false;
    return { tempPasswordError: null, newPasswordError: setNewPasswordResult.error.message };
  }

  loadingText.value = 'Storing encrypted credentials...';

  /* Add Organization Credentials */
  let email;
  if (props.personalUser.useKeychain) {
    if (!formData.organizationEmail) {
      throw new Error('(BUG) Organization email is required');
    }
    email = formData.organizationEmail;
  } else {
    email = props.personalUser.email;
  }

  const addOrganizationCredentialsResult = await safeAwait(
    addOrganizationCredentials(
      email,
      formData.newOrganizationPassword,
      organizationId.value,
      props.personalUser.personalId,
      organizationJwtToken.value || '',
      props.personalUser.password,
    ),
  );
  if ('error' in addOrganizationCredentialsResult) {
    loading.value = false;
    throw addOrganizationCredentialsResult.error;
  }

  /* Restore Existing Keys */
  const restoreExistingKeysResult = await safeAwait(restoreExistingKeys(formData));

  if ('error' in restoreExistingKeysResult) {
    loading.value = false;
    throw restoreExistingKeysResult.error;
  }

  loading.value = false;
  emit('setOrganizationId', organizationId.value);

  return { tempPasswordError: null, newPasswordError: null };
};

/* Functions */
const setupOrganization = async ({ organizationURL, organizationNickname }: ModelValue) => {
  const { id } = await addOrganization({
    nickname: organizationNickname,
    serverUrl: organizationURL,
    key: '',
  });
  return id;
};

const loginInOrganization = async ({
  organizationURL,
  organizationEmail,
  temporaryOrganizationPassword,
}: ModelValue) => {
  let email;
  if (props.personalUser.useKeychain) {
    if (!organizationEmail) {
      throw new Error('(BUG) Organization email is required');
    }
    email = organizationEmail;
  } else {
    email = props.personalUser.email;
  }

  const { id, jwtToken } = await login(organizationURL, email, temporaryOrganizationPassword);
  toggleAuthTokenInSessionStorage(organizationURL, jwtToken, false);

  organizationUserId.value = id;
  organizationJwtToken.value = jwtToken;
};

const setNewPassword = async ({
  organizationURL,
  temporaryOrganizationPassword,
  newOrganizationPassword,
}: ModelValue) => {
  await changePassword(organizationURL, temporaryOrganizationPassword, newOrganizationPassword);
};

const restoreExistingKeys = async ({ organizationURL }: ModelValue) => {
  if (!organizationUserId.value) throw new Error('(BUG) Organization user id not set');

  const { userKeys } = await getUserState(organizationURL);

  const userKeysWithMnemonic = userKeys.filter(userKeyHasMnemonic);

  if (userKeysWithMnemonic.length === 0) {
    for (let i = 0; i < 99; i++) {
      const result = await safeAwait(restoreKeyPair(organizationURL, i, 'Default', true));
      if (!result.error) break;
    }
    return;
  }

  for (let i = 0; i < userKeysWithMnemonic.length; i++) {
    const userKey = userKeysWithMnemonic[i];

    /**
     * Restore key if it has a mnemonic hash and is the same as imported
     * If keys from multiple mnemonic phrases are present, they will be deleted as the system supports only one mnemonic phrase
     */
    if (userKeyHasMnemonic(userKey)) {
      const { data: matchedHash, error } = await safeAwait(
        compareHash([...props.recoveryPhrase.words].toString(), userKey.mnemonicHash),
      );

      if (!error && matchedHash) {
        await safeAwait(
          restoreKeyPair(organizationURL, userKey.index, `Restored Key ${i + 1}`, false),
        );
      } else {
        await safeAwait(deleteKey(organizationURL, organizationUserId.value, userKey.id));
      }
    }
  }
};

const restoreKeyPair = async (
  organizationURL: string,
  index: number,
  nickname: string,
  upload: boolean,
) => {
  if (!props.recoveryPhrase) throw new Error('(BUG) Recovery phrase not set');
  if (organizationUserId.value === null) throw new Error('(BUG) Organization user id not set');

  const passphrase = '';
  const type = 'ED25519';
  const restoredPrivateKey = await restorePrivateKey(
    props.recoveryPhrase.words,
    passphrase,
    index,
    type,
  );

  const keyPair: Prisma.KeyPairUncheckedCreateInput = {
    user_id: props.personalUser.personalId,
    index,
    public_key: restoredPrivateKey.publicKey.toStringRaw(),
    private_key: restoredPrivateKey.toStringRaw(),
    type,
    organization_id: organizationId.value,
    organization_user_id: organizationUserId.value,
    secret_hash: props.recoveryPhrase.hash,
    nickname,
  };

  if (upload) {
    await uploadKey(organizationURL, organizationUserId.value, {
      publicKey: keyPair.public_key,
      index: keyPair.index,
      mnemonicHash: keyPair.secret_hash || undefined,
    });
  }

  await storeKeyPair(
    keyPair,
    props.personalUser.useKeychain ? null : props.personalUser.password,
    false,
  );
};
</script>
<template>
  <SetupOrganizationForm
    :loading="loading"
    :loading-text="loadingText"
    :personal-user="personalUser"
    :submit-callback="handleFormSubmit"
  />
</template>
