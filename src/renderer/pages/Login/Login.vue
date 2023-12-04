<script setup lang="ts">
import { ref } from 'vue';

import AppButton from '../../components/ui/AppButton.vue';
import useUserStateStore from '../../stores/storeUserState';
import { useRouter } from 'vue-router';

const router = useRouter();
const userStateStore = useUserStateStore();

const inputEmail = ref('');
const inputPassword = ref('');
const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);

const handleOnFormSubmit = (event: Event) => {
  event.preventDefault();

  const emailValid = inputEmail.value.trim() === '';
  const passwordValid = inputPassword.value.trim() === '';

  inputEmailInvalid.value = emailValid;
  inputPasswordInvalid.value = passwordValid;

  if (!inputEmailInvalid.value && !inputPasswordInvalid.value) {
    //SEND LOGIN REQUEST
    const loginReq = { successful: true };

    //IF LOGGED IN
    if (!loginReq.successful) {
      //NOTIFY USER
      return;
    }

    userStateStore.logUser(inputEmail.value, inputPassword.value);

    //CHECK IF IS INITIAL LOGIN
    const isInitial = true; //TEMPORARY

    if (isInitial) {
      router.push({ name: 'newPassword' });
    } else {
      //REDIRECT TO DEFAULT LOGGED ROUTE?
      router.push({ name: 'settingsGeneral' });
    }
  }
};
</script>

<template>
  <div class="p-10 d-flex flex-column justify-content-center align-items-center">
    <h1 class="text-display text-bold text-center">Login</h1>
    <p class="text-main mt-5 text-center">Please Enter Temporary email and password</p>
    <form
      @submit="handleOnFormSubmit"
      class="form-login mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
    >
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <input
          v-model="inputEmail"
          type="text"
          class="form-control rounded-4"
          :class="{ 'is-invalid': inputEmailInvalid }"
          placeholder="Email"
        />
        <div v-if="inputEmailInvalid" class="invalid-feedback">Invalid e-mail.</div>
      </div>
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <input
          v-model="inputPassword"
          type="password"
          class="form-control rounded-4"
          :class="{ 'is-invalid': inputPasswordInvalid }"
          placeholder="Password"
        />
        <div v-if="inputPasswordInvalid" class="invalid-feedback">Invalid password.</div>
      </div>
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <AppButton color="primary" size="large" type="submit" class="mt-2 w-100 rounded-4"
          >Login</AppButton
        >
      </div>
    </form>
  </div>
</template>
