<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { clearKeys } from '../../services/keyPairService';

import useUserStateStore from '../../stores/storeUserState';

import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';

const router = useRouter();

const userStateStore = useUserStateStore();

const inputNewPassword = ref('');
const inputConfrimPassword = ref('');
const inputNewPasswordInvalid = ref(false);
const inputConfirmPasswordInvalid = ref(false);

const isSuccessModalShown = ref(false);

watch(inputConfrimPassword, val => {
  if (val.length === 0) {
    inputConfirmPasswordInvalid.value = false;
  }
});

const handleFormSubmit = (event: Event) => {
  event.preventDefault();

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
      isSuccessModalShown.value = true;
    } else {
      //NOTIFY USER
    }
  }
};

const handleDone = () => {
  router.push({ name: 'recoveryPhrase' });
};
</script>

<template>
  <div class="new-password-page p-10 d-flex flex-column justify-content-center align-items-center">
    <h1 class="text-display text-bold text-center">New Password</h1>
    <p class="text-main mt-5 text-center">Please enter new password</p>
    <form
      @submit="handleFormSubmit"
      class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
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
      </div>
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <input
          v-model="inputConfrimPassword"
          type="password"
          class="form-control rounded-4"
          :class="{ 'is-invalid': inputConfirmPasswordInvalid }"
          placeholder="Confirm new Password"
        />
        <div v-if="inputConfirmPasswordInvalid" class="invalid-feedback">
          Passwords do not match.
        </div>
      </div>
      <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
        <AppButton
          color="primary"
          size="large"
          type="submit"
          class="w-100 rounded-4"
          :disabled="inputNewPassword.length === 0 || inputConfrimPassword.length === 0"
          >Continue</AppButton
        >
      </div>
    </form>
    <AppModal v-model:show="isSuccessModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSuccessModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i
            class="bi bi-check-lg extra-large-icon cursor-pointer"
            style="line-height: 16px"
            @click="isSuccessModalShown = false"
          ></i>
        </div>

        <h3 class="mt-5 text-main text-center text-bold">Password Created Successfully</h3>
        <!-- <p class="text-center text-small">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p> -->
        <AppButton color="primary" size="large" class="mt-5 w-100 rounded-4" @click="handleDone"
          >Done</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
