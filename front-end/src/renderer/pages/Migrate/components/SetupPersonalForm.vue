<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { encrypt, isKeychainAvailable } from '@renderer/services/safeStorageService';

import { isEmail, isPasswordStrong } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Types */
export type ModelValue = {
  email: string;
  password: string;
  useKeychain: boolean;
};

/* Props */
defineProps<{
  loading: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'submit', value: ModelValue): void;
}>();

/* State */
const useKeychain = ref(false);

const inputEmail = ref('');
const inputPassword = ref('');

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);

const passwordRequirements = reactive({
  length: false,
});

const tooltipContent = ref('');

/* Composables */
const createTooltips = useCreateTooltips();

/* Handlers */
const handleOnFormSubmit = async (e: Event) => {
  e.preventDefault();

  const email = inputEmail.value.trim();
  const password = inputPassword.value.trim();

  inputEmailInvalid.value = email === '' || !isEmail(email);
  inputPasswordInvalid.value = password === '' || !checkPassword(password);

  if (inputEmailInvalid.value || (!useKeychain.value && inputPasswordInvalid.value)) {
    return;
  }

  emit('submit', {
    email: email,
    password: password,
    useKeychain: useKeychain.value,
  });
};

const handleUseKeychain = async (value: boolean) => {
  if (useKeychain.value === value) return;

  inputPassword.value = '';
  inputPasswordInvalid.value = false;
  checkPassword('');

  if (!value) {
    useKeychain.value = value;
    return;
  }

  const keychainAvailable = await isKeychainAvailable();

  if (!keychainAvailable) {
    useKeychain.value = false;
    throw Error('Keychain not available');
  }

  await encrypt('gain_access');

  useKeychain.value = value;
};

/* Functions */
function checkPassword(pass: string) {
  const { length, result } = isPasswordStrong(pass);
  passwordRequirements.length = length;
  return result;
}

function setTooltipContent() {
  tooltipContent.value = `
    <div class='d-flex flex-column align-items-start px-3' data-testid='tooltip-requirements'>
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

/* Hooks */
onMounted(async () => {
  checkPassword(inputPassword.value);
  createTooltips();
  setTooltipContent();
});

/* Watchers */
watch(inputEmail, email => {
  if (isEmail(email) || email.length === 0) inputEmailInvalid.value = false;
  setTooltipContent();
});
watch(inputPassword, pass => {
  if (checkPassword(pass) || pass.length === 0) inputPasswordInvalid.value = false;
});
</script>
<template>
  <form @submit="handleOnFormSubmit" class="flex-column-100">
    <div class="fill-remaining">
      <p class="text-secondary text-small lh-base text-center">
        Fill the information for authenticating in the application
      </p>

      <p class="text-secondary text-small lh-base text-center">
        You may use the keychain or a password to encrypt sensitive data
      </p>

      <!-- Email -->
      <div>
        <label data-testid="label-email" class="form-label mt-4">Email</label>
        <AppInput
          data-testid="input-email"
          v-model="inputEmail"
          :filled="true"
          :class="{ 'is-invalid': inputEmailInvalid }"
          placeholder="Enter e-mail"
        />
        <div v-if="inputEmailInvalid" data-testid="invalid-text-email" class="invalid-feedback">
          Invalid e-mail.
        </div>
      </div>

      <div>
        <label data-testid="label-email" class="form-label mt-4">Encryption mode</label>
        <div class="btn-group w-100">
          <AppButton
            type="button"
            class="min-w-unset"
            :color="'secondary'"
            :class="{ active: !useKeychain }"
            @click="handleUseKeychain(false)"
            data-testid="button-use-credentials"
            >Credentials</AppButton
          >
          <AppButton
            type="button"
            class="min-w-unset"
            :color="'secondary'"
            :class="{ active: useKeychain }"
            @click="handleUseKeychain(true)"
            data-testid="button-use-keychain"
            >Keychain</AppButton
          >
        </div>
      </div>
      <template v-if="!useKeychain">
        <!-- Password -->
        <div>
          <label data-testid="label-password" class="form-label mt-4">Password</label>
          <AppInput
            v-model="inputPassword"
            :filled="true"
            type="password"
            :class="{ 'is-invalid': inputPasswordInvalid }"
            placeholder="Enter password"
            data-bs-toggle="tooltip"
            data-bs-animation="false"
            data-bs-placement="right"
            data-bs-custom-class="wide-xl-tooltip text-start"
            data-bs-html="true"
            data-bs-title="_"
            data-testid="input-password"
          />
          <div
            v-if="inputPasswordInvalid"
            data-testid="invalid-text-password"
            class="invalid-feedback"
          >
            Invalid password.
          </div>
        </div>
      </template>
      <template v-else>
        <p class="mt-4">
          The application will use the keychain to encrypt and decrypt sensitive data
        </p>
      </template>
    </div>

    <!-- Submit -->
    <div class="d-flex justify-content-end align-items-end mt-5">
      <div>
        <AppButton
          color="primary"
          type="submit"
          class="w-100"
          loading-text="Migrating..."
          :loading="loading"
          :disabled="
            inputEmail.trim().length === 0 || (!useKeychain && inputPassword.trim().length === 0)
          "
          data-testid="button-setup-personal"
          >Continue</AppButton
        >
      </div>
    </div>
  </form>
</template>
