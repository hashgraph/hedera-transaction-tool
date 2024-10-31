<script setup lang="ts">
import type { RecoveryPhrase } from '@renderer/types';
import type { PersonalUser } from './SetupPersonal.vue';
import type { ModelValue, SubmitCallback } from './SetupOrganizationForm.vue';

import { ref } from 'vue';

import { addOrganization } from '@renderer/services/organizationsService';
import { changePassword, login } from '@renderer/services/organization';
import { addOrganizationCredentials } from '@renderer/services/organizationCredentials';

import { safeAwait, toggleAuthTokenInSessionStorage } from '@renderer/utils';

import SetupOrganizationForm from './SetupOrganizationForm.vue';

/* Props */
const props = defineProps<{
  recoveryPhrase: RecoveryPhrase;
  personalUser: PersonalUser;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'setOrganizationId', value: string): void;
  (event: 'migration:cancel'): void;
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

  loading.value = false;
  emit('setOrganizationId', organizationId.value);

  return { tempPasswordError: null, newPasswordError: null };
};

const handleMigrationCancel = () => emit('migration:cancel');

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
</script>
<template>
  <SetupOrganizationForm
    :loading="loading"
    :loading-text="loadingText"
    :personal-user="personalUser"
    :submit-callback="handleFormSubmit"
    @migration:cancel="handleMigrationCancel"
  />
</template>
