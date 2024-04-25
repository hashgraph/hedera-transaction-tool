<script setup lang="ts">
import { ref } from 'vue';

import { useRouter } from 'vue-router';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Composables */
const router = useRouter();

/* State */
const inputEmail = ref('');

/* Handlers */
const handleFormSubmit = (event: Event) => {
  event.preventDefault();

  // SEND BACK END PASSWORD RESET REQUEST FOR ENTERED EMAIL

  router.push({ name: 'login' });
};
</script>

<template>
  <div class="new-password-page p-10 d-flex flex-column justify-content-center align-items-center">
    <h1 class="text-display text-bold text-center">Forgot Password</h1>
    <p class="text-main mt-5 text-center">Please enter your email</p>
    <form
      @submit="handleFormSubmit"
      class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
    >
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <AppInput v-model="inputEmail" :filled="true" placeholder="Enter your email" />
      </div>
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <AppButton
          color="primary"
          size="large"
          type="submit"
          class="w-100"
          :disabled="inputEmail.length === 0"
          >Continue</AppButton
        >
      </div>
    </form>
  </div>
</template>
