<script setup lang="ts">
import { ref, watch } from 'vue';

import { clearKeys } from '../../../services/keyPairService';
import useUserStateStore from '../../../stores/storeUserState';

import AppButton from '../../../components/ui/AppButton.vue';

const props = defineProps<{
  handleContinue: () => void;
}>();

const userStateStore = useUserStateStore();

const inputNewPassword = ref('');
const inputConfrimPassword = ref('');

const inputNewPasswordInvalid = ref(false);
const inputConfirmPasswordInvalid = ref(false);

const isLoading = ref(false);

watch(inputConfrimPassword, val => {
  if (val.length === 0 || inputNewPassword.value === val) {
    inputConfirmPasswordInvalid.value = false;
  }
});

const handleFormSubmit = (event: Event) => {
  event.preventDefault();

  try {
    isLoading.value = true;

    const newPasswordValid = inputNewPassword.value.trim() === '';

    inputNewPasswordInvalid.value = newPasswordValid;
    inputConfirmPasswordInvalid.value = inputNewPassword.value !== inputConfrimPassword.value;

    if (!inputNewPasswordInvalid.value && !inputConfirmPasswordInvalid.value) {
      //SEND PASSWORD RESET REQUEST

      //CHECK IF IS SUCCESSFUL
      const isChanged = true; //TEMPORARY

      if (isChanged) {
        // OPEN MODAL
        userStateStore.userData && clearKeys(userStateStore.userData?.userId);
        props.handleContinue();
      } else {
        //NOTIFY USER
      }
    }
  } catch (error) {
    console.log(error);
  } finally {
    isLoading.value = false;
  }
};
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
        <input
          v-model="inputNewPassword"
          type="password"
          class="form-control rounded-4"
          :class="{ 'is-invalid': inputNewPasswordInvalid }"
          placeholder="New Password"
        />
        <div v-if="inputNewPasswordInvalid" class="invalid-feedback">Invalid password.</div>
        <input
          v-model="inputConfrimPassword"
          type="password"
          class="form-control rounded-4 mt-4"
          :class="{ 'is-invalid': inputConfirmPasswordInvalid }"
          placeholder="Confirm new Password"
        />
        <div v-if="inputConfirmPasswordInvalid" class="invalid-feedback">
          Passwords do not match.
        </div>
        <AppButton
          color="primary"
          size="large"
          type="submit"
          class="w-100 rounded-4 mt-5"
          :loading="isLoading"
          :disabled="inputNewPassword.length === 0 || inputConfrimPassword.length === 0"
          >Continue</AppButton
        >
      </div>
    </form>
  </div>
</template>
