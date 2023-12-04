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
    //SEND LOGIN REQUST

    //IF LOGGED IN
    userStateStore.logUser();

    //CHECK IF IS INITIAL LOGIN
    const isInitial = true; //TEMPORARY

    if (isInitial) {
      router.push({});
    } else {
      //REDIRECT TO DEFAULT LOGGED ROUTE?
      router.push({ name: 'settingsGeneral' });
    }
  }
};
</script>

<template>
  <div class="p-10 d-flex justify-content-center align-items-center">
    <div>
      <h1 class="text-huge text-bold text-center">Login</h1>
      <p class="text-main mt-3">Please Enter Temporary email and password</p>
      <form @submit="handleOnFormSubmit" class="form-login">
        <div class="mt-4">
          <input
            v-model="inputEmail"
            type="text"
            class="form-control rounded-4"
            :class="{ 'is-invalid': inputEmailInvalid }"
            placeholder="Email"
          />
          <div v-if="inputEmailInvalid" class="invalid-feedback">Invalid e-mail.</div>
        </div>
        <div class="mt-4">
          <input
            v-model="inputPassword"
            type="password"
            class="form-control rounded-4"
            :class="{ 'is-invalid': inputPasswordInvalid }"
            placeholder="Password"
          />
          <div v-if="inputPasswordInvalid" class="invalid-feedback">Invalid password.</div>
        </div>
        <div class="d-grid mt-4">
          <AppButton color="primary" size="large" type="submit" class="mt-2 rounded-4"
            >Login</AppButton
          >
        </div>
      </form>
    </div>
  </div>
</template>
