<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import { login } from '@renderer/services/organization/authService';
import {
  addOrganizationCredentials,
  shouldSignInOrganization,
} from '@renderer/services/organizationCredentials';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import UserPasswordModal from '@renderer/components/UserPasswordModal.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const toast = useToast();

/* State */
const userPassword = ref('');

const inputEmail = ref('');
const inputPassword = ref('');

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);

const userPasswordModalShow = ref(true);

/* Handlers */
const handleOnFormSubmit = async (e: Event) => {
  e.preventDefault();

  if (!user.data.activeOrganization) {
    throw new Error("Active organization doesn't exist.");
  }

  if (userPassword.value.length === 0) {
    userPasswordModalShow.value = true;
  } else {
    await handleLogin();
  }
};

const handleLogin = async () => {
  if (!user.data.activeOrganization) {
    throw new Error("Active organization doesn't exist.");
  }

  try {
    const accessToken = await login(
      user.data.activeOrganization.serverUrl,
      inputEmail.value,
      inputPassword.value,
    );

    await addOrganizationCredentials(
      inputEmail.value,
      inputPassword.value,
      user.data.activeOrganization.id,
      user.data.id,
      accessToken,
      userPassword.value,
      true,
    );

    toast.success('Successfully signed in');
  } catch (error: any) {
    inputEmailInvalid.value = true;
    inputPasswordInvalid.value = true;

    throw new Error(error.message);
  }
};

const handleForgotPassword = async () => {};

/* Hooks */
onMounted(() => {
  if (!user.data.activeOrganization) {
    router.push(router.previousPath ? { path: router.previousPath } : { name: 'transactions' });
  }
});

/* Watchers */
watch([inputEmail, inputPassword], () => {
  inputEmailInvalid.value = false;
  inputPasswordInvalid.value = false;
});

watch(
  () => user.data.activeOrganization,
  async activeOrganization => {
    if (activeOrganization) {
      const flag = await shouldSignInOrganization(user.data.id, activeOrganization.id);

      if (!flag) {
        user.setIsSigningInOrganization(false);
        router.push(router.previousPath ? { path: router.previousPath } : { name: 'transactions' });
      }
    }
  },
);
</script>
<template>
  <div class="p-10 flex-column flex-centered flex-1 overflow-hidden">
    <div class="container-dark-border glow-dark-bg p-5" style="max-width: 530px">
      <h4 class="text-title text-semi-bold text-center">Sign In</h4>
      <p class="text-secondary text-small text-truncate lh-base text-center mt-3">
        Organization <span class="text-pink">{{ user.data.activeOrganization?.nickname }}</span>
      </p>

      <form @submit="handleOnFormSubmit" class="form-login mt-5">
        <label class="form-label">Email</label>
        <AppInput
          v-model="inputEmail"
          :filled="true"
          :class="{ 'is-invalid': inputEmailInvalid }"
          placeholder="Enter email"
        />
        <div v-if="inputEmailInvalid" class="invalid-feedback">Invalid e-mail.</div>
        <label class="form-label mt-4">Password</label>
        <AppInput
          v-model="inputPassword"
          :filled="true"
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
              :disabled="inputEmail.length === 0 || inputPassword.length === 0"
              >Sign in</AppButton
            >
          </div>
        </div>
      </form>

      <UserPasswordModal
        v-model:show="userPasswordModalShow"
        heading="Enter personal password"
        subHeading="Credentials will be encrypted with this password"
        @passwordEntered="userPassword = $event"
      />
    </div>
  </div>
</template>
