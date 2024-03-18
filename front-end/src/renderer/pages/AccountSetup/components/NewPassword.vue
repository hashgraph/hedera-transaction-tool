<script setup lang="ts">
import { ref, watch } from 'vue';

import useKeyPairsStore from '@renderer/stores/storeKeyPairs';
import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

// import { deleteEncryptedPrivateKeys } from '@renderer/services/keyPairService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  handleContinue: (password: string) => void;
}>();

/* Stores */
const keyPairsStore = useKeyPairsStore();
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
      if (!user.data.isLoggedIn || !user.data.activeServerURL || !user.data.activeUserId) {
        throw new Error('User is not logged in');
      }

      isLoading.value = true;

      //SEND PASSWORD RESET REQUEST
      // await deleteEncryptedPrivateKeys(
      //   user.data.id,
      // );
      await keyPairsStore.refetch();
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
  <div class="new-password-page p-10 d-flex flex-column justify-content-center align-items-center">
    <h1 class="text-display text-bold text-center">New Password</h1>
    <p class="mt-5 text-main text-center">Please enter new password</p>
    <form
      @submit="handleFormSubmit"
      class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center"
    >
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
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
