<script setup lang="ts">
import { onMounted, ref } from 'vue';

// import useUserStore from '@renderer/stores/storeUser';

// import { useRouter } from 'vue-router';
// import { useToast } from 'vue-toast-notification';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Stores */
// const user = useUserStore();

/* State */
const inputEmail = ref('');
const inputPassword = ref('');

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);

/* Handlers */
const handleOnFormSubmit = async (event: Event) => {
  event.preventDefault();

  try {
    // userData = await loginLocal(inputEmail.value, inputPassword.value, keepLoggedIn.value, false);
  } catch (error: any) {
    inputEmailInvalid.value = false;
    inputPasswordInvalid.value = false;
  }
};

const handleForgotPassword = async () => {};

/* Hooks */
onMounted(async () => {});
</script>
<template>
  <div class="p-10 flex-column flex-centered flex-1 overflow-hidden">
    <div class="container-dark-border glow-dark-bg p-5">
      <h4 class="text-title text-semi-bold text-center">Sign In</h4>
      <p class="text-secondary text-small lh-base text-center mt-3">
        Enter your e-mail and password
      </p>

      <form @submit="handleOnFormSubmit" class="form-login mt-5 w-100">
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
    </div>
  </div>
</template>
