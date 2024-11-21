<script setup lang="ts">
import type { GLOBAL_MODAL_LOADER_TYPE, USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';
import { inject, onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

import { login } from '@renderer/services/organization';
import { addOrganizationCredentials } from '@renderer/services/organizationCredentials';

import { isLoggedOutOrganization, isUserLoggedIn, withLoader } from '@renderer/utils';

import { GLOBAL_MODAL_LOADER_KEY, USER_PASSWORD_MODAL_KEY } from '@renderer/providers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import ForgotPasswordModal from '@renderer/components/ForgotPasswordModal.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();
useSetDynamicLayout({
  loggedInClass: false,
  shouldSetupAccountClass: false,
  showMenu: false,
});

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);
const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

/* State */
const loading = ref(false);
const inputEmail = ref('');
const inputPassword = ref('');

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);

const forgotPasswordModalShown = ref(false);

/* Handlers */
const handleOnFormSubmit = async (e: Event) => {
  e.preventDefault();

  handleLogin();
};

const handleLogin = async () => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  const personalPassword = user.getPassword();
  if (!personalPassword && !user.personal.useKeychain) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter your application password',
      'Enter your application password to encrypt your organization credentials',
      handleLogin,
    );
    return;
  }

  if (!isLoggedOutOrganization(user.selectedOrganization))
    throw new Error('Please select active organization');

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
    toast.success('Successfully signed in');

    loading.value = false;

    await withLoader(
      async () => {
        await user.refetchOrganizations();
      },
      toast,
      globalModalLoaderRef?.value,
      'Failed to change user mode',
    )();
  } catch (error: any) {
    inputEmailInvalid.value = true;
    inputPasswordInvalid.value = true;

    toast.error(error.message);
  } finally {
    loading.value = false;
  }
};

const handleForgotPassword = () => {
  // const personalPassword = user.getPassword();
  // if (!personalPassword) {
  //   if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
  //   userPasswordModalRef.value?.open('Enter personal password', null, handleForgotPassword);
  // } else {
  //   forgotPasswordModalShown.value = true;
  // }

  forgotPasswordModalShown.value = true;
};

/* Hooks */
onMounted(() => {
  if (!user.selectedOrganization) {
    router.push(router.previousPath ? { path: router.previousPath } : { name: 'transactions' });
  }
});

/* Watchers */
watch([inputEmail, inputPassword], () => {
  inputEmailInvalid.value = false;
  inputPasswordInvalid.value = false;
});

/* Guards */
onBeforeRouteLeave(async () => {
  try {
    await user.refetchUserState();
  } catch {
    user.selectOrganization(null);
  }

  if (!user.selectedOrganization) return true;

  if (user.selectedOrganization.loginRequired) {
    return false;
  }

  return true;
});
</script>
<template>
  <div class="p-10 flex-column flex-centered flex-1 overflow-hidden">
    <div class="container-dark-border glow-dark-bg p-5" style="max-width: 530px">
      <h4 class="text-title text-semi-bold text-center">Sign In</h4>
      <p class="text-secondary text-small text-truncate lh-base text-center mt-3">
        Organization <span class="text-pink">{{ user.selectedOrganization?.nickname }}</span>
      </p>

      <form @submit="handleOnFormSubmit" class="form-login mt-5">
        <label class="form-label">Email</label>
        <AppInput
          v-model="inputEmail"
          :filled="true"
          data-testid="input-login-email-for-organization"
          :class="{ 'is-invalid': inputEmailInvalid }"
          placeholder="Enter email"
        />
        <div v-if="inputEmailInvalid" class="invalid-feedback">Invalid e-mail.</div>
        <label class="form-label mt-4">Password</label>
        <AppInput
          v-model="inputPassword"
          :filled="true"
          data-testid="input-login-password-for-organization"
          type="password"
          :class="{ 'is-invalid': inputPasswordInvalid }"
          placeholder="Enter password"
        />
        <div v-if="inputPasswordInvalid" class="invalid-feedback">Invalid password.</div>

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
              :disabled="inputEmail.length === 0 || inputPassword.length === 0"
              >Sign in</AppButton
            >
          </div>
        </div>
      </form>

      <ForgotPasswordModal v-model:show="forgotPasswordModalShown" />
    </div>
  </div>
</template>
