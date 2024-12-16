<script setup lang="ts">
import type { PersonalUser } from './SetupPersonal.vue';

import { ref, watch } from 'vue';

import { isPasswordStrong, isUrl } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';

/* Types */
export type ModelValue = {
  organizationURL: string;
  organizationEmail: string | null;
  organizationNickname: string;
  temporaryOrganizationPassword: string;
  newOrganizationPassword: string;
};

export type SubmitCallback = (value: ModelValue) => Promise<{ error: string | null }>;

/* Props */
const props = defineProps<{
  loading: boolean;
  loadingText: string;
  personalUser: PersonalUser;
  submitCallback: SubmitCallback;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'migration:cancel'): void;
}>();

/* State */
const inputOrganizationNickname = ref('');
const inputOrganizationURL = ref('');
const inputOrganizationEmail = ref('');
const inputTemporaryOrganizationPassword = ref('');
const inputNewOrganizationPassword = ref('');

const inputOrganizationURLInvalid = ref(false);
const loginError = ref<string | null>(null);

/* Handlers */
const handleOnFormSubmit = async () => {
  const organizationURL = inputOrganizationURL.value.trim();
  const organizationEmail = inputOrganizationEmail.value.trim();
  const organizationNickname = inputOrganizationNickname.value.trim();
  const temporaryOrganizationPassword = inputTemporaryOrganizationPassword.value.trim();
  const newOrganizationPassword = inputNewOrganizationPassword.value.trim();

  inputOrganizationURLInvalid.value = organizationURL === '' || !checkUrl(organizationURL);

  if (
    inputOrganizationURLInvalid.value || props.personalUser.useKeychain
      ? organizationEmail.length === 0
      : false || temporaryOrganizationPassword.length === 0 || loginError.value
  )
    return;

  const result = await props.submitCallback({
    organizationURL,
    organizationEmail: props.personalUser.useKeychain
      ? organizationEmail
      : props.personalUser.email,
    organizationNickname: organizationNickname || 'Organization 1',
    temporaryOrganizationPassword,
    newOrganizationPassword,
  });

  loginError.value = result.error;
};

const handleCancel = () => emit('migration:cancel');

/* Functions */
function checkUrl(url: string) {
  const urlValid = isUrl(url);
  if (urlValid) inputOrganizationURL.value = new URL(url).origin;
  return urlValid;
}

/* Watchers */
watch(inputOrganizationURL, url => {
  if (checkUrl(url) || url.length === 0) inputOrganizationURLInvalid.value = false;
});
watch(inputNewOrganizationPassword, pass => {
  if (isPasswordStrong(pass) && pass !== inputTemporaryOrganizationPassword.value)
    inputOrganizationURLInvalid.value = false;
});
</script>
<template>
  <form @submit.prevent="handleOnFormSubmit" class="flex-column-100">
    <div class="fill-remaining">
      <p class="text-secondary text-small lh-base text-center">
        Fill the information to setup your organization
      </p>

      <!-- Organization Nickname -->
      <div class="mt-4">
        <label data-testid="label-organization-nickname" class="form-label"
          >Organization Nickname (Optional)</label
        >
        <AppInput
          data-testid="input-organization-nickname"
          v-model="inputOrganizationNickname"
          :filled="true"
          placeholder="Enter nickname"
        />
      </div>

      <!-- Organization URL -->
      <div class="mt-4">
        <label data-testid="label-organization-url" class="form-label">Organization URL</label>
        <AppInput
          data-testid="input-organization-url"
          v-model="inputOrganizationURL"
          :filled="true"
          :class="{ 'is-invalid': inputOrganizationURLInvalid }"
          placeholder="Enter URL"
        />
        <div
          v-if="inputOrganizationURLInvalid"
          data-testid="invalid-text-organization-url"
          class="invalid-feedback"
        >
          Invalid URL.
        </div>
      </div>

      <!-- Organization Email -->
      <div v-if="personalUser.useKeychain" class="mt-4">
        <label data-testid="label-organization-email" class="form-label">Organization Email</label>
        <AppInput
          data-testid="input-organization-email"
          v-model="inputOrganizationEmail"
          :filled="true"
          placeholder="Enter Email"
        />
      </div>

      <!-- Temporary Organization Password -->
      <div class="mt-4">
        <label data-testid="label-temp-password" class="form-label"
          >Temporary Organization Password</label
        >
        <AppPasswordInput
          v-model="inputTemporaryOrganizationPassword"
          :filled="true"
          placeholder="Enter password"
          data-testid="input-temporary-organization-password"
        />
      </div>

      <!-- New Organization Password -->
      <div class="mt-4">
        <label data-testid="label-new-password" class="form-label">New Organization Password</label>
        <AppPasswordInput
          v-model="inputNewOrganizationPassword"
          :filled="true"
          placeholder="Enter password"
          data-testid="input-new-organization-password"
        />
      </div>
    </div>

    <div class="mt-5">
      <p class="text-small text-danger">{{ loginError }}</p>
    </div>

    <hr class="separator mt-2" />

    <!-- Submit -->
    <div class="d-flex justify-content-between align-items-end mt-5">
      <div>
        <AppButton
          color="secondary"
          type="button"
          data-testid="button-migration-cancel"
          @click="handleCancel"
          >Cancel</AppButton
        >
      </div>
      <div>
        <AppButton
          color="primary"
          type="submit"
          :loading="loading"
          :loading-text="loadingText"
          :disabled="
            inputTemporaryOrganizationPassword.trim().length === 0 ||
            inputOrganizationURL.trim().length === 0 ||
            (personalUser.useKeychain ? inputOrganizationEmail.length === 0 : false) ||
            inputNewOrganizationPassword.trim().length === 0 ||
            inputNewOrganizationPassword.trim() === inputTemporaryOrganizationPassword.trim()
          "
          data-testid="button-migration-setup-organization"
          >Continue</AppButton
        >
      </div>
    </div>
  </form>
</template>
