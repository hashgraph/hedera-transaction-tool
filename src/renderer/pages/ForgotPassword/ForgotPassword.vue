<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import AppButton from '../../components/ui/AppButton.vue';

const router = useRouter();

const inputEmail = ref('');

const handleFormSubmit = (event: Event) => {
  event.preventDefault();

  // SEND BACK END PASSWORD RESET REQUEST FOR ENTERED EMAIL

  router.push({ name: 'welcome' });
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
        <input
          v-model="inputEmail"
          type="text"
          class="form-control rounded-4"
          placeholder="Enter your email"
        />
      </div>
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <AppButton
          color="primary"
          size="large"
          type="submit"
          class="w-100 rounded-4"
          :disabled="inputEmail.length === 0"
          >Continue</AppButton
        >
      </div>
    </form>
  </div>
</template>
