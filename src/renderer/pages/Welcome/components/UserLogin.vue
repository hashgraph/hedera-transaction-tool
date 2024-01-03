<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { jwtDecode } from 'jwt-decode';

import { IUserData } from '../../../../main/shared/interfaces/IUserData';

import useUserStateStore from '../../../stores/storeUserState';

import { getStoredKeysSecretHashes } from '../../../services/keyPairService';

import AppSwitch from '../../../components/ui/AppSwitch.vue';
import AppButton from '../../../components/ui/AppButton.vue';

const router = useRouter();
const userStateStore = useUserStateStore();

const inputEmail = ref('');
const inputPassword = ref('');

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);

const isInitialLogin = ref(false); // Temporary

const handleOnFormSubmit = async (event: Event) => {
  event.preventDefault();

  const emailValid = inputEmail.value.trim() === '';
  const passwordValid = inputPassword.value.trim() === '';

  inputEmailInvalid.value = emailValid;
  inputPasswordInvalid.value = passwordValid;

  if (!inputEmailInvalid.value && !inputPasswordInvalid.value) {
    //SEND LOGIN REQUEST
    const loginRes = {
      successful: true,
      accessToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InBpcEBnbWFpbC5jb20iLCJ1c2VybmFtZSI6IkhlZGVyYVVzZXIiLCJ1c2VySWQiOiIxMjM0NTY3ODkifQ.iPZBw37mI7iBgOOPzDQYilx_y4h-DLE2h8EqEg6ZgbU',
      isInitial: false,
      secretHash: 'hash',
    };

    try {
      const decodedUserData: IUserData = jwtDecode(loginRes.accessToken);
      userStateStore.logUser(loginRes.accessToken, decodedUserData, isInitialLogin.value);

      // Compare with saved keys' secret hash
      // userStateStore.setSecretHashes([loginRes.secretHash]);
      const secretHashes = await getStoredKeysSecretHashes(decodedUserData.userId);
      secretHashes.length > 0 && userStateStore.setSecretHashes(secretHashes);
    } catch (error) {
      console.log(error);
    }

    if (isInitialLogin.value) {
      router.push({ name: 'accountSetup' });
    } else {
      // @ts-ignore
      router.push(router.previousPath ? { path: router.previousPath } : { name: 'settingsKeys' });
    }
  }
};
</script>
<template>
  <div class="container-welcome-card container-modal-card p-5 border border-dark-subtle rounded-4">
    <template v-if="userStateStore.role === 'personal'">
      <i class="bi bi-person mt-5 extra-large-icon d-block"></i>
    </template>
    <template v-if="userStateStore.role === 'organization'">
      <i class="bi bi-briefcase mt-5 extra-large-icon"></i>
    </template>

    <h4 class="mt-4 text-main text-bold text-center">
      Login as {{ userStateStore.role === 'personal' ? 'Personal' : 'Organization' }} User
    </h4>
    <p class="text-secondary text-small lh-base text-center">
      In order to continue enter your email & password
    </p>

    <form @submit="handleOnFormSubmit" class="form-login mt-5 w-100">
      <input
        v-model="inputEmail"
        type="text"
        class="form-control rounded-4"
        :class="{ 'is-invalid': inputEmailInvalid }"
        placeholder="Enter email"
      />
      <div v-if="inputEmailInvalid" class="invalid-feedback">Invalid e-mail.</div>
      <input
        v-model="inputPassword"
        type="password"
        class="mt-4 form-control rounded-4"
        :class="{ 'is-invalid': inputPasswordInvalid }"
        placeholder="Enter password"
      />
      <div v-if="inputPasswordInvalid" class="invalid-feedback">Invalid password.</div>
      <div class="mt-3">
        <RouterLink :to="{ name: 'forgotPassword' }" class="text-small link-primary"
          >Forgot password</RouterLink
        >
      </div>
      <!-- Temporary -->
      <div class="w-100 mt-4 d-flex justify-content-start">
        <AppSwitch
          v-model:checked="isInitialLogin"
          name="is-initial-login"
          label="Initial Login"
        ></AppSwitch>
      </div>
      <AppButton color="primary" size="large" type="submit" class="mt-5 w-100 rounded-4"
        >Login</AppButton
      >

      <template v-if="userStateStore.role === 'organization'">
        <div class="mt-5 text-center">
          <RouterLink :to="{ name: 'setupOrganization' }" class="link-primary"
            >Add Organization</RouterLink
          >
        </div>
      </template>
    </form>
  </div>
</template>
