<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { jwtDecode } from 'jwt-decode';

import { IUserData } from '../../../../main/shared/interfaces/IUserData';

import useUserStateStore from '../../../stores/storeUserState';

import AppButton from '../../../components/ui/AppButton.vue';

const router = useRouter();
const userStateStore = useUserStateStore();

const inputEmail = ref('');
const inputPassword = ref('');

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);

const handleRegister = () => {};

const handleOnFormSubmit = (event: Event) => {
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
    };

    try {
      const decodedUserData: IUserData = jwtDecode(loginRes.accessToken);
      userStateStore.logUser(loginRes.accessToken, decodedUserData);
    } catch (error) {
      console.log(error);
    }

    if (loginRes.isInitial) {
      router.push({ name: 'newPassword' });
    } else {
      //REDIRECT TO DEFAULT LOGGED ROUTE?
      router.push({ name: 'settingsGeneral' });
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
    <form
      @submit="handleOnFormSubmit"
      class="form-login mt-5 w-100 d-flex flex-column justify-content-center align-items-center"
    >
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
      <RouterLink
        :to="{ name: 'forgotPassword' }"
        class="align-self-start d-inline-block ms-3 mt-3 text-muted text-small cursor-pointer text-decoration-none"
        >Forgot password</RouterLink
      >
      <AppButton color="primary" size="large" type="submit" class="mt-5 w-100 rounded-4"
        >Login</AppButton
      >
      <p class="mt-5">or</p>
      <template v-if="userStateStore.role === 'personal'">
        <p class="mt-5 text-bold cursor-pointer" @click="handleRegister">Register</p>
      </template>
      <template v-if="userStateStore.role === 'organization'">
        <RouterLink
          :to="{ name: 'setupOrganization' }"
          class="mt-5 text-body text-bold text-decoration-none"
          >Add Organization</RouterLink
        >
      </template>
    </form>
  </div>
</template>
