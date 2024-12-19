<script setup lang="ts">
import { onBeforeMount, onMounted, reactive, ref, watch } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { encrypt, isKeychainAvailable } from '@renderer/services/safeStorageService';

import { isEmail, isPasswordStrong } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';
import AppSeparator from '@renderer/components/ui/AppSeparator.vue';

/* Types */
export type ModelValue =
  | {
      useKeychain: true;
      email: null;
      password: null;
    }
  | {
      useKeychain: false;
      email: string;
      password: string;
    };

/* Props */
defineProps<{
  loading: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'submit', value: ModelValue): void;
  (event: 'migration:cancel'): void;
}>();

/* State */
const keychainSelected = ref(false);
const keychainAvailable = ref(false);

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
const handleOnFormSubmit = async () => {
  const email = inputEmail.value.trim();
  const password = inputPassword.value.trim();

  inputEmailInvalid.value = email === '' || !isEmail(email);
  inputPasswordInvalid.value = password === '' || !checkPassword(password);

  if (inputEmailInvalid.value || inputPasswordInvalid.value) {
    return;
  }

  keychainSelected.value = false;
  emit('submit', {
    useKeychain: false,
    email,
    password,
  });
};

const handleCancel = () => emit('migration:cancel');

const handleUseKeychain = async () => {
  const keychainAvailable = await isKeychainAvailable();

  if (!keychainAvailable) {
    throw Error('Keychain not available');
  }

  await encrypt('gain_access');

  keychainSelected.value = true;
  emit('submit', {
    useKeychain: true,
    email: null,
    password: null,
  });
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
onBeforeMount(async () => {
  keychainAvailable.value = await isKeychainAvailable();
});

onMounted(async () => {
  checkPassword(inputPassword.value);
  createTooltips();
  setTooltipContent();
});

/* Watchers */
watch(inputEmail, email => {
  if (isEmail(email) || email.length === 0) inputEmailInvalid.value = false;
});
watch(inputPassword, pass => {
  if (checkPassword(pass) || pass.length === 0) inputPasswordInvalid.value = false;
  setTooltipContent();
});
</script>
<template>
  <form @submit.prevent="handleOnFormSubmit" class="flex-column-100" v-focus-first-input>
    <div class="fill-remaining">
      <p class="text-secondary text-small lh-base text-center">Enter e-mail and password</p>

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

      <!-- Password -->
      <div>
        <label data-testid="label-password" class="form-label mt-4">Password</label>
        <AppPasswordInput
          v-model="inputPassword"
          :filled="true"
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
    </div>

    <div class="d-grid mt-5">
      <AppButton
        color="primary"
        type="submit"
        loading-text="Migrating..."
        :loading="loading && !keychainSelected"
        :disabled="inputEmail.trim().length === 0 || inputPassword.trim().length === 0"
        data-testid="button-setup-personal"
        >Continue</AppButton
      >
    </div>

    <template v-if="keychainAvailable">
      <AppSeparator class="my-5" text="or" />

      <div class="d-grid">
        <AppButton
          color="secondary"
          type="button"
          @click="handleUseKeychain"
          loading-text="Migrating..."
          :loading="loading && keychainSelected"
          data-testid="button-setup-personal"
          >Continue with Keychain</AppButton
        >
      </div>
    </template>

    <!-- Submit -->
    <div class="mt-5">
      <AppButton
        color="secondary"
        type="button"
        data-testid="button-migration-cancel"
        @click="handleCancel"
        >Cancel</AppButton
      >
    </div>
  </form>
</template>
