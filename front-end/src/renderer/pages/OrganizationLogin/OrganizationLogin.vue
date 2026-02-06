<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useLoader from '@renderer/composables/useLoader';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useSetDynamicLayout, { DEFAULT_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useRecoveryPhraseHashMigrate from '@renderer/composables/useRecoveryPhraseHashMigrate';
import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';

import { login } from '@renderer/services/organization';
import { addOrganizationCredentials } from '@renderer/services/organizationCredentials';

import {
  assertUserLoggedIn,
  getErrorMessage,
  isEmail,
  isLoggedOutOrganization,
  isOrganizationActive,
  redirectToPrevious,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';
import ForgotPasswordModal from '@renderer/components/ForgotPasswordModal.vue';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();
const withLoader = useLoader();
useSetDynamicLayout(DEFAULT_LAYOUT);
const { getPassword, passwordModalOpened } = usePersonalPassword();
const { redirectIfRequiredKeysToMigrate } = useRecoveryPhraseHashMigrate();
const { setLast } = useDefaultOrganization();

/* State */
const loading = ref(false);
const inputEmail = ref('');
const inputPassword = ref('');

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);

const forgotPasswordModalShown = ref(false);

/* Computed */
const isPrimaryButtonDisabled = computed(() => {
  return !isEmail(inputEmail.value) || inputPassword.value.length === 0;
});

/* Handlers */
const handleLogin = async () => {
  assertUserLoggedIn(user.personal);
  const personalPassword = getPassword(handleLogin, {
    subHeading: 'Enter your application password to encrypt your organization credentials',
  });
  if (passwordModalOpened(personalPassword)) return;

  if (!isLoggedOutOrganization(user.selectedOrganization)) {
    throw new Error('Please select active organization');
  }

  try {
    loading.value = true;

    const { jwtToken } = await login(
      user.selectedOrganization.serverUrl,
      inputEmail.value.toLocaleLowerCase().trim(),
      inputPassword.value,
    );

    await addOrganizationCredentials(
      inputEmail.value.toLocaleLowerCase().trim(),
      inputPassword.value,
      user.selectedOrganization.id,
      user.personal.id,
      jwtToken,
      personalPassword,
      true,
    );
    await user.refetchOrganizationTokens();

    toast.success('Successfully signed in', successToastOptions);

    loading.value = false;

    await withLoader(
      user.selectOrganization.bind(null, user.selectedOrganization),
      'Failed to change user mode',
      10000,
      false,
    );

    if (isOrganizationActive(user.selectedOrganization)) {
      await setLast(user.selectedOrganization.id);
    }

    await withLoader(
      redirectIfRequiredKeysToMigrate,
      'Failed to redirect to recovery phrase migration',
      10000,
      false,
    );
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to sign in'), errorToastOptions);
    inputEmailInvalid.value = true;
    inputPasswordInvalid.value = true;
  } finally {
    loading.value = false;
  }
};

const handleForgotPassword = () => {
  inputEmail.value = '';
  inputPassword.value = '';
  forgotPasswordModalShown.value = true;
};

/* Hooks */
onMounted(async () => {
  if (!user.selectedOrganization) {
    await redirectToPrevious(router, { name: 'transactions' });
  }
});

/* Watchers */
watch([inputEmail, inputPassword], () => {
  inputEmailInvalid.value = false;
  inputPasswordInvalid.value = false;
});

/* Guards */
onBeforeRouteLeave(async () => {
  return (
    !user.selectedOrganization ||
    (isOrganizationActive(user.selectedOrganization) && !user.selectedOrganization.loginRequired)
  );
});
</script>
<template>
  <div class="p-10 flex-column flex-centered flex-1 overflow-hidden">
    <div class="container-dark-border glow-dark-bg p-5" style="max-width: 530px">
      <h4 class="text-title text-semi-bold text-center">Sign In</h4>
      <p class="text-secondary text-small text-truncate lh-base text-center mt-3">
        Organization <span class="text-pink">{{ user.selectedOrganization?.nickname }}</span>
      </p>

      <form @submit.prevent="handleLogin" class="form-login mt-5">
        <label class="form-label">Email</label>
        <AppInput
          v-model="inputEmail"
          :filled="true"
          data-testid="input-login-email-for-organization"
          :class="{ 'is-invalid': inputEmailInvalid }"
          placeholder="Enter email"
        />
        <div v-if="inputEmailInvalid" class="invalid-feedback">Invalid e-mail</div>
        <label class="form-label mt-4">Password</label>
        <AppPasswordInput
          v-model="inputPassword"
          :filled="true"
          data-testid="input-login-password-for-organization"
          :class="{ 'is-invalid': inputPasswordInvalid }"
          placeholder="Enter password"
        />
        <div v-if="inputPasswordInvalid" class="invalid-feedback">Invalid password</div>

        <div class="flex-centered justify-content-between gap-3 mt-3">
          <span @click="handleForgotPassword" class="text-small link-primary cursor-pointer"
            >Forgot password</span
          >
        </div>

        <div class="row justify-content-end mt-5">
          <div class="d-grid">
            <AppButton
              color="primary"
              type="submit"
              data-testid="button-sign-in-organization-user"
              :loading="loading"
              :disabled="isPrimaryButtonDisabled"
              >Sign in</AppButton
            >
          </div>
        </div>
      </form>

      <ForgotPasswordModal v-model:show="forgotPasswordModalShown" />
    </div>
  </div>
</template>
