<script setup lang="ts">
import type { PersonalUser } from './SetupPersonal.vue';
import type { ModelValue, SubmitCallback } from './SetupOrganizationForm.vue';
import SetupOrganizationForm from './SetupOrganizationForm.vue';

import { ref } from 'vue';
import { healthCheck, login } from '@renderer/services/organization';

import { safeAwait } from '@renderer/utils';
import { getVersionStatusForOrg } from '@renderer/stores/versionState';

/* Props */
const props = defineProps<{
  personalUser: PersonalUser;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'setOrganizationSetup', value: ModelValue | null): void;
  (event: 'migration:cancel'): void;
}>();

/* State */
const loading = ref(false);
const loadingText = ref<string>('');
const organizationURL = ref<string | null>(null);
const organizationEmail = ref<string | null>(null);

/* Handlers */
const handleFormSubmit: SubmitCallback = async (
  formData: ModelValue,
): Promise<{ error: string | null }> => {
  loading.value = true;

  // Check version compatibility
  if (organizationURL.value !== formData.organizationURL) {
    loadingText.value = 'Checking version compatibility...';
    await healthCheck(formData.organizationURL);
    if (getVersionStatusForOrg(formData.organizationURL) === 'belowMinimum') {
      loading.value = false;
      return {
        error:
          'Your app version is no longer supported by this organization. Please update the app before continuing migration.',
      };
    }
    organizationURL.value = formData.organizationURL;
    organizationEmail.value = null;
  }

  // Check login
  if (organizationEmail.value !== formData.organizationEmail) {
    loadingText.value = 'Logging in Organization...';
    const loginInOrganizationResult = await safeAwait(checkLoginInOrganization(formData));
    if (loginInOrganizationResult.error instanceof Error) {
      loading.value = false;
      return { error: loginInOrganizationResult.error.message };
    }
    organizationEmail.value = formData.organizationEmail;
  }

  emit('setOrganizationSetup', formData);
  loading.value = false;

  return { error: null };
};

const handleSkip = () => {
  emit('setOrganizationSetup', null);
};

const handleMigrationCancel = () => emit('migration:cancel');

/* Functions */
const checkLoginInOrganization = async (data: ModelValue) => {
  let email;
  if (props.personalUser.useKeychain) {
    if (!data.organizationEmail) {
      throw new Error('(BUG) Organization email is required');
    }
    email = data.organizationEmail;
  } else {
    email = props.personalUser.email;
  }

  await login(data.organizationURL, email, data.temporaryOrganizationPassword);
};
</script>
<template>
  <SetupOrganizationForm
    :loading="loading"
    :loading-text="loadingText"
    :personal-user="personalUser"
    :submit-callback="handleFormSubmit"
    @skip-organization-setup="handleSkip"
    @migration:cancel="handleMigrationCancel"
  />
</template>
