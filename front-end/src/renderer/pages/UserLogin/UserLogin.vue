<script setup lang="ts">
import { onMounted, ref } from 'vue';

import useSetDynamicLayout, { DEFAULT_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { getUsersCount } from '@renderer/services/userService';

import EmailLoginForm from './components/EmailLoginForm.vue';
import AppSeparator from '@renderer/components/ui/AppSeparator.vue';
import KeychainOption from './components/KeychainOption.vue';

/* Composables */
useSetDynamicLayout(DEFAULT_LAYOUT);

/* State */
const shouldRegister = ref(false);

/* Hooks */
onMounted(async () => {
  await checkShouldRegister();
});

/* Misc */
async function checkShouldRegister() {
  try {
    const usersCount = await getUsersCount();
    shouldRegister.value = usersCount < 2; /* 2 because the first user is the default */
  } catch {
    shouldRegister.value = true;
  }
}
</script>
<template>
  <div class="p-10 flex-column flex-centered flex-1 overflow-hidden">
    <div class="container-dark-border glow-dark-bg p-5">
      <h4 class="text-title text-semi-bold text-center">
        {{ shouldRegister ? 'Register' : 'Sign In' }}
      </h4>
      <p class="text-secondary text-small lh-base text-center mt-3">
        {{ shouldRegister ? 'Enter e-mail and password' : 'Enter your e-mail and password' }}
      </p>

      <EmailLoginForm v-model:should-register="shouldRegister" @data:reset="checkShouldRegister" />

      <template v-if="shouldRegister">
        <AppSeparator class="my-5" text="or" />

        <KeychainOption />
      </template>
    </div>
  </div>
</template>
