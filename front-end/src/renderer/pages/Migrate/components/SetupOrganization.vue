<script setup lang="ts">
import type { RecoveryPhrase } from '@renderer/types';
import type { ModelValue, SubmitCallback } from './SetupOrganizationForm.vue';

import { ref } from 'vue';

import { addOrganization } from '@renderer/services/organizationsService';
import { changePassword, login } from '@renderer/services/organization';

import { safeAwait } from '@renderer/utils/safeAwait';

import SetupOrganizationForm from './SetupOrganizationForm.vue';
import { addOrganizationCredentials } from '@renderer/services/organizationCredentials';

/* Props */
const props = defineProps<{
  recoveryPhrase: RecoveryPhrase;
  email: string;
  password: string | null;
  personalId: string;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'setOrganizationId', value: string): void;
}>();

/* State */
const loading = ref(false);
const loadingText = ref<string>('');
const organizationId = ref<string | null>(null);
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
  await addOrganizationCredentials(
    props.email,
    formData.newOrganizationPassword,
    organizationId.value,
    props.personalId,
    props.password,
  );

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
  temporaryOrganizationPassword,
}: ModelValue) => {
  await login(organizationURL, props.email, temporaryOrganizationPassword);
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
    :submit-callback="handleFormSubmit"
  />
</template>
