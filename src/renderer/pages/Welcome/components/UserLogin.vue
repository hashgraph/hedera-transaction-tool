<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

import useLocalUserStateStore from '../../../stores/storeLocalUserState';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import * as localUserService from '../../../services/localUserService';

import { isEmail } from '../../../utils/validator';

import AppButton from '../../../components/ui/AppButton.vue';
import { getStoredKeysSecretHashes } from '@renderer/services/keyPairService';

/* Stores */
const localUserStateStore = useLocalUserStateStore();

/* Composables */
const toast = useToast();
const router = useRouter();

/* State */
const inputEmail = ref('');
const inputPassword = ref('');

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);
const passwordRequirements = reactive({
  length: false,
  lowercase: false,
  uppercase: false,
  number: false,
  special: false,
});
const tooltipContent = ref('');

/* Handlers */
const handleOnFormSubmit = async (event: Event) => {
  event.preventDefault();

  inputEmailInvalid.value = inputEmail.value.trim() === '' || !isEmail(inputEmail.value);
  inputPasswordInvalid.value =
    inputPassword.value.trim() === '' || !isPasswordStrong(inputPassword.value);

  if (inputPasswordInvalid.value) {
    toast.error('Password too weak', { position: 'top-right' });
    return;
  }

  if (!inputEmailInvalid.value && !inputPasswordInvalid.value) {
    try {
      const userData = await localUserService.login(inputEmail.value, inputPassword.value, true);
      const secretHashes = await getStoredKeysSecretHashes(inputEmail.value);

      localUserStateStore.logUser(userData);
      localUserStateStore.setSecretHashes(secretHashes);

      if (secretHashes.length === 0) {
        localUserStateStore.userState.password = inputPassword.value;
        router.push({ name: 'accountSetup' });
      } else {
        router.push(router.previousPath ? { path: router.previousPath } : { name: 'settingsKeys' });
      }

      toast.success('Successfully logged in', { position: 'top-right' });
    } catch (err: any) {
      let message = 'Login failed';
      if (err.message && typeof err.message === 'string') {
        message = err.message;
      }
      toast.error(message, { position: 'top-right' });
    }
  }
};
const handleResetData = async () => {
  if (isEmail(inputEmail.value)) {
    await localUserService.resetData(inputEmail.value, { authData: true });
    toast.success('User data has been reset', { position: 'top-right' });
  }
};

/* Hooks */
onMounted(() => {
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  Array.from(tooltipTriggerList).map(tooltipTriggerEl => new Tooltip(tooltipTriggerEl));

  isPasswordStrong(inputPassword.value);
  setTooltipContent();
});

/* Misc */
function isPasswordStrong(password: string) {
  const validationRegex = [
    { regex: /.{10,}/ }, // min 10 letters,
    { regex: /[0-9]/ }, // numbers from 0 - 9
    { regex: /[a-z]/ }, // letters from a - z (lowercase)
    { regex: /[A-Z]/ }, // letters from A-Z (uppercase),
    { regex: /[^A-Za-z0-9]/ }, // special characters
  ];

  passwordRequirements.length = validationRegex[0].regex.test(password);
  passwordRequirements.number = validationRegex[1].regex.test(password);
  passwordRequirements.lowercase = validationRegex[2].regex.test(password);
  passwordRequirements.uppercase = validationRegex[3].regex.test(password);
  passwordRequirements.special = validationRegex[4].regex.test(password);

  const isStrong = validationRegex.reduce((isStrong, item) => {
    const isValid = item.regex.test(password);
    return isStrong && isValid;
  }, true);

  return isStrong;
}

function setTooltipContent() {
  tooltipContent.value = `
          <div class='d-flex flex-column align-items-start px-3'>
            <div class='${
              passwordRequirements.lowercase ? 'text-success' : 'text-danger'
            }'><i class='bi bi-${
              passwordRequirements.lowercase ? 'check' : 'x'
            }'></i>Lower case character</div>
            <div class='${
              passwordRequirements.uppercase ? 'text-success' : 'text-danger'
            }'><i class='bi bi-${
              passwordRequirements.uppercase ? 'check' : 'x'
            }'></i>Upper case character</div>
            <div class='${
              passwordRequirements.number ? 'text-success' : 'text-danger'
            }'><i class='bi bi-${passwordRequirements.number ? 'check' : 'x'}'></i>Have number</div>
            <div class='${
              passwordRequirements.special ? 'text-success' : 'text-danger'
            }'><i class='bi bi-${
              passwordRequirements.special ? 'check' : 'x'
            }'></i>Special character</div>
            <div class='${
              passwordRequirements.length ? 'text-success' : 'text-danger'
            }'><i class='bi bi-${
              passwordRequirements.length ? 'check' : 'x'
            }'></i>Be at least 10 characters</div>
          </div>
        `;

  const tooltipList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  Array.from(tooltipList).forEach(tooltipEl => {
    const tooltip = Tooltip.getInstance(tooltipEl);
    tooltip?.setContent({ '.tooltip-inner': tooltipContent.value });
  });
}

/* Watchers */
watch(inputPassword, pass => {
  if (isPasswordStrong(pass) || pass.length === 0) {
    inputPasswordInvalid.value = false;
  }
  setTooltipContent();
});
watch(inputEmail, pass => {
  if (isEmail(pass) || pass.length === 0) {
    inputEmailInvalid.value = false;
  }
});
</script>
<template>
  <div class="container-welcome-card container-modal-card p-5 border border-dark-subtle rounded-4">
    <i class="bi bi-person mt-5 extra-large-icon d-block"></i>
    <h4 class="mt-4 text-main text-bold text-center">Login as Personal user</h4>
    <p class="text-secondary text-small lh-base text-center">
      In order to continue enter your email & password
    </p>

    <form @submit="handleOnFormSubmit" class="form-login mt-5 w-100">
      <input
        v-model="inputEmail"
        type="text"
        class="form-control rounded-4"
        :class="{ 'is-invalid': inputEmailInvalid }"
        placeholder="Enter email"
      />
      <div v-if="inputEmailInvalid" class="invalid-feedback">Invalid e-mail.</div>
      <input
        v-model="inputPassword"
        type="password"
        class="mt-4 form-control rounded-4"
        :class="{ 'is-invalid': inputPasswordInvalid }"
        placeholder="Enter password"
        data-bs-toggle="tooltip"
        data-bs-animation="false"
        data-bs-placement="right"
        data-bs-custom-class="wide-xl-tooltip text-start"
        data-bs-html="true"
        data-bs-title="_"
      />
      <div v-if="inputPasswordInvalid" class="invalid-feedback">Invalid password.</div>
      <div class="mt-3">
        <span @click="handleResetData" class="text-small link-primary cursor-pointer"
          >Reset data</span
        >
      </div>
      <AppButton
        color="primary"
        size="large"
        type="submit"
        class="rounded-4 mt-5 w-100"
        :disabled="inputEmail.length === 0 || inputPassword.length === 0"
        >Login</AppButton
      >
    </form>
  </div>
</template>
