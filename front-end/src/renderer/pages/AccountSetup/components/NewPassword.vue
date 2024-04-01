<script setup lang="ts">
import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

// import { deleteEncryptedPrivateKeys } from '@renderer/services/keyPairService';
import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  handleContinue: (password: string) => void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const inputNewPassword = ref('');
const inputConfrimPassword = ref('');

const inputNewPasswordInvalid = ref(false);
const inputConfirmPasswordInvalid = ref(false);

const isLoading = ref(false);

/* Handlers */
const handleFormSubmit = async (event: Event) => {
  event.preventDefault();

  const newPasswordValid = inputNewPassword.value.trim() === '';

  inputNewPasswordInvalid.value = newPasswordValid;
  inputConfirmPasswordInvalid.value = inputNewPassword.value !== inputConfrimPassword.value;

  if (!inputNewPasswordInvalid.value && !inputConfirmPasswordInvalid.value) {
    try {
      if (!isUserLoggedIn(user.personal)) {
        throw new Error('User is not logged in');
      }

      isLoading.value = true;

      //SEND PASSWORD RESET REQUEST

      props.handleContinue(inputNewPassword.value);

      toast.success('Password changed successfully', { position: 'bottom-right' });
    } catch (err: any) {
      let message = 'Failed to change password';
      if (err.message && typeof err.message === 'string') {
        message = err.message;
      }
      toast.error(message, { position: 'bottom-right' });
    } finally {
      isLoading.value = false;
    }
  }
};

/* Watchers */
watch(inputConfrimPassword, val => {
  if (val.length === 0 || inputNewPassword.value === val) {
    inputConfirmPasswordInvalid.value = false;
  }
});
</script>

<template>
  <div class="fill-remaining flex-centered flex-column mt-4">
    <h1 class="text-display text-bold text-center">New Password</h1>
    <p class="text-main text-center mt-5">Please enter new password</p>
    <form @submit="handleFormSubmit" class="row justify-content-center w-100 mt-5">
      <div class="col-12 col-md-8 col-lg-6">
        <AppInput
          v-model="inputNewPassword"
          :filled="true"
          :class="{ 'is-invalid': inputNewPasswordInvalid }"
          type="password"
          placeholder="New Password"
        />
        <div v-if="inputNewPasswordInvalid" class="invalid-feedback">Invalid password.</div>
        <AppInput
          v-model="inputConfrimPassword"
          :filled="true"
          class="mt-4"
          :class="{ 'is-invalid': inputConfirmPasswordInvalid }"
          type="password"
          placeholder="Confirm new Password"
        />
        <div v-if="inputConfirmPasswordInvalid" class="invalid-feedback">
          Passwords do not match.
        </div>
        <AppButton
          color="primary"
          size="large"
          type="submit"
          class="w-100 mt-5"
          :loading="isLoading"
          :disabled="inputNewPassword.length === 0 || inputConfrimPassword.length === 0"
          >Continue</AppButton
        >
      </div>
    </form>
  </div>
</template>
