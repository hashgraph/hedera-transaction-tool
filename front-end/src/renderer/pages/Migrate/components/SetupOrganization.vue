<script setup lang="ts">
import type { RecoveryPhrase } from '@renderer/types';
import type { PersonalUser } from './SetupPersonal.vue';
import type { ModelValue, SubmitCallback } from './SetupOrganizationForm.vue';

import { ref } from 'vue';

import { addOrganization, deleteOrganization } from '@renderer/services/organizationsService';
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
const organizationURL = ref<string | null>(null);
const organizationUserId = ref<number | null>(null);
const organizationEmail = ref<string | null>(null);
const organizationJwtToken = ref<string | null>(null);
const loggedIn = ref(false);

/* Handlers */
const handleFormSubmit: SubmitCallback = async (formData: ModelValue) => {
  loading.value = true;

  const sameOrganization = organizationURL.value === formData.organizationURL;
  const sameEmail = organizationEmail.value === formData.organizationEmail;

  /* Add Organization */
  if (!organizationId.value || !sameOrganization) {
    loadingText.value = 'Adding Organization...';
    if (organizationId.value) {
      await safeAwait(deleteOrganization(organizationId.value));
    }
    const setupOrganizationResult = await safeAwait(setupOrganization(formData));
    if ('error' in setupOrganizationResult) {
      loading.value = false;
      throw setupOrganizationResult.error;
    }
    organizationId.value = setupOrganizationResult.data;
    organizationURL.value = formData.organizationURL;
  }

  /* Login in Organization */
  if (!loggedIn.value || !sameOrganization || !sameEmail) {
    loadingText.value = 'Logging in Organization...';
    const loginInOrganizationResult = await safeAwait(loginInOrganization(formData));
    if (loginInOrganizationResult.error instanceof Error) {
      loading.value = false;
      return { error: loginInOrganizationResult.error.message };
    }
    loggedIn.value = true;
  }

  /* Set New Password */
  loadingText.value = 'Setting New Password...';
  const setNewPasswordResult = await safeAwait(setNewPassword(formData));
  if (setNewPasswordResult.error instanceof Error) {
    loading.value = false;
    return { error: setNewPasswordResult.error.message };
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
      true,
    ),
  );
  if ('error' in addOrganizationCredentialsResult) {
    loading.value = false;
    throw addOrganizationCredentialsResult.error;
  }

  loading.value = false;
  emit('setOrganizationId', organizationId.value);

  return { error: null };
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

const loginInOrganization = async (data: ModelValue) => {
  let email;
  if (props.personalUser.useKeychain) {
    if (!data.organizationEmail) {
      throw new Error('(BUG) Organization email is required');
    }
    email = data.organizationEmail;
  } else {
    email = props.personalUser.email;
  }

  const { id, jwtToken } = await login(
    data.organizationURL,
    email,
    data.temporaryOrganizationPassword,
  );
  toggleAuthTokenInSessionStorage(data.organizationURL, jwtToken, false);

  organizationUserId.value = id;
  organizationJwtToken.value = jwtToken;
  organizationEmail.value = email;
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
