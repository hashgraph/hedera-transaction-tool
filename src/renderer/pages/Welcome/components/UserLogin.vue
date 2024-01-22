<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

import useUserStore from '../../../stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useCreateTooltips from '../../../composables/useCreateTooltips';

import {
  loginLocal,
  registerLocal,
  resetDataLocal,
  hasRegisteredUsers,
} from '../../../services/userService';

import { isEmail } from '../../../utils/validator';

import AppButton from '../../../components/ui/AppButton.vue';
import { getStoredKeysSecretHashes } from '@renderer/services/keyPairService';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const createTooltips = useCreateTooltips();

/* State */
const inputEmail = ref('');
const inputPassword = ref('');
const inputConfirmPassword = ref('');

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);
const inputConfirmPasswordInvalid = ref(false);
const passwordRequirements = reactive({
  length: false,
  lowercase: false,
  uppercase: false,
  number: false,
  special: false,
});
const tooltipContent = ref('');
const shouldRegister = ref(false);

/* Handlers */
const handleOnFormSubmit = async (event: Event) => {
  event.preventDefault();

  if (shouldRegister.value) {
    inputEmailInvalid.value = inputEmail.value.trim() === '' || !isEmail(inputEmail.value);
    inputPasswordInvalid.value =
      inputPassword.value.trim() === '' || !isPasswordStrong(inputPassword.value);
    inputConfirmPasswordInvalid.value =
      inputPassword.value.trim() !== inputConfirmPassword.value.trim();
  }

  if (
    shouldRegister.value &&
    !inputConfirmPasswordInvalid.value &&
    !inputEmailInvalid.value &&
    !inputPasswordInvalid.value
  ) {
    if (inputPasswordInvalid.value) {
      toast.error('Password too weak', { position: 'bottom-right' });
      return;
    }
    await registerLocal(inputEmail.value, inputPassword.value);
    user.login(inputEmail.value, []);
    user.data.password = inputPassword.value;
    router.push({ name: 'accountSetup' });
  } else if (!shouldRegister.value) {
    try {
      await loginLocal(inputEmail.value, inputPassword.value, false);
      const secretHashes = await getStoredKeysSecretHashes(inputEmail.value);
      user.login(inputEmail.value, secretHashes);

      if (secretHashes.length === 0) {
        user.data.password = inputPassword.value;
        router.push({ name: 'accountSetup' });
      } else {
        router.push(router.previousPath ? { path: router.previousPath } : { name: 'settingsKeys' });
      }
    } catch (error: any) {
      inputEmailInvalid.value = false;
      inputPasswordInvalid.value = false;

      if (error.message.includes('email')) {
        inputEmailInvalid.value = true;
      }
      if (error.message.includes('password')) {
        inputPasswordInvalid.value = true;
      }
    }
  }
};

const handleResetData = async () => {
  await resetDataLocal();
  toast.success('User data has been reset', { position: 'bottom-right' });
  inputEmailInvalid.value = false;
  inputPasswordInvalid.value = false;
  inputConfirmPasswordInvalid.value = false;
  await checkShouldRegister();
};

/* Hooks */
onMounted(async () => {
  isPasswordStrong(inputPassword.value);
  await checkShouldRegister();

  if (shouldRegister.value) {
    createTooltips();
    setTooltipContent();
  }
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

async function checkShouldRegister() {
  try {
    shouldRegister.value = !(await hasRegisteredUsers());
  } catch (error) {
    shouldRegister.value = true;
  }
}

/* Watchers */
watch(inputPassword, pass => {
  inputConfirmPasswordInvalid.value = false;
  if (isPasswordStrong(pass) || pass.length === 0) {
    inputPasswordInvalid.value = false;
  }
  setTooltipContent();
});
watch(inputConfirmPassword, pass => {
  if (pass.length === 0) {
    inputPasswordInvalid.value = false;
  }
});
watch(inputEmail, pass => {
  if (shouldRegister.value && (isEmail(pass) || pass.length === 0)) {
    inputEmailInvalid.value = false;
  }
});
</script>
<template>
  <div class="container-dark-border p-5">
    <h4 class="text-title text-bold text-center">
      {{ shouldRegister ? 'Register' : 'Sign In' }}
    </h4>
    <p class="text-secondary text-small lh-base text-center mt-3">
      Enter your username and password
    </p>

    <form @submit="handleOnFormSubmit" class="form-login mt-5 w-100">
      <label class="form-label">Email</label>
      <input
        v-model="inputEmail"
        type="text"
        class="form-control is-fill"
        :class="{ 'is-invalid': inputEmailInvalid }"
        placeholder="Enter email"
      />
      <div v-if="inputEmailInvalid" class="invalid-feedback">Invalid e-mail.</div>
      <label class="form-label mt-4">Password</label>
      <input
        v-model="inputPassword"
        type="password"
        class="form-control is-fill"
        :class="{ 'is-invalid': inputPasswordInvalid }"
        placeholder="Enter password"
        :data-bs-toggle="shouldRegister ? 'tooltip' : ''"
        data-bs-animation="false"
        data-bs-placement="right"
        data-bs-custom-class="wide-xl-tooltip text-start"
        data-bs-html="true"
        data-bs-title="_"
      />
      <div v-if="inputPasswordInvalid" class="invalid-feedback">Invalid password.</div>
      <template v-if="shouldRegister">
        <label class="form-label mt-4">Confirm password</label>
        <input
          v-model="inputConfirmPassword"
          type="password"
          class="form-control is-fill"
          :class="{ 'is-invalid': inputConfirmPasswordInvalid }"
          placeholder="Confirm password"
        />
        <div v-if="inputConfirmPasswordInvalid" class="invalid-feedback">
          Password do not match.
        </div>
      </template>

      <div class="mt-3 text-end">
        <span @click="handleResetData" class="text-small link-primary cursor-pointer"
          >Reset account</span
        >
      </div>
      <AppButton
        color="primary"
        size="large"
        type="submit"
        class="mt-5 w-100"
        :disabled="inputEmail.length === 0 || inputPassword.length === 0"
        >{{ shouldRegister ? 'Register' : 'Sign In' }}</AppButton
      >
    </form>
  </div>
</template>
