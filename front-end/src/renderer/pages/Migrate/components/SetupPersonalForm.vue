<script setup lang="ts">
import { nextTick, onBeforeMount, onMounted, reactive, ref, watch } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { encrypt, isKeychainAvailable } from '@renderer/services/safeStorageService';

import { isEmail, isPasswordStrong } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';

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
const keychainAvailable = ref(false);
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

  if (!useKeychain.value) {
    inputEmailInvalid.value = email === '' || !isEmail(email);
    inputPasswordInvalid.value = password === '' || !checkPassword(password);

    if (inputEmailInvalid.value || inputPasswordInvalid.value) {
      return;
    }
  }

  emit(
    'submit',
    useKeychain.value
      ? { useKeychain: true, email: null, password: null }
      : {
          useKeychain: false,
          email,
          password,
        },
  );
};

const handleCancel = () => emit('migration:cancel');

const handleUseKeychain = async (value: boolean) => {
  if (useKeychain.value === value) return;

  inputEmail.value = '';
  inputEmailInvalid.value = false;
  inputPassword.value = '';
  inputPasswordInvalid.value = false;
  checkPassword('');

  if (!value) {
    useKeychain.value = false;
    await nextTick();
    createTooltips();
    setTooltipContent();
    return;
  }

  const keychainAvailable = await isKeychainAvailable();

  if (!keychainAvailable) {
    useKeychain.value = false;
    throw Error('Keychain not available');
  }

  await encrypt('gain_access');

  useKeychain.value = true;
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
  <form @submit="handleOnFormSubmit" class="flex-column-100" v-focus-first-input>
    <div class="fill-remaining">
      <p class="text-secondary text-small lh-base text-center">
        Fill the information for authenticating in the application
      </p>

      <p class="text-secondary text-small lh-base text-center">
        You may use the keychain or a password to encrypt sensitive data
      </p>

      <div v-if="keychainAvailable">
        <label data-testid="label-email" class="form-label mt-4">Encryption mode</label>
        <div class="btn-group-container mt-4" role="group">
          <div class="btn-group gap-3 w-100">
            <AppButton
              class="rounded-3 min-w-unset"
              :class="{ active: !useKeychain, 'text-body': useKeychain }"
              :color="!useKeychain ? 'primary' : undefined"
              @click="handleUseKeychain(false)"
              type="button"
              data-testid="button-use-credentials"
              >Credentials</AppButton
            >
            <AppButton
              class="rounded-3 min-w-unset"
              :class="{ active: useKeychain, 'text-body': !useKeychain }"
              :color="useKeychain ? 'primary' : undefined"
              @click="handleUseKeychain(true)"
              type="button"
              data-testid="button-use-keychain"
              >Keychain</AppButton
            >
          </div>
        </div>
      </div>

      <!-- Email -->
      <div>
        <label data-testid="label-email" class="form-label mt-4">Email</label>
        <AppInput
          data-testid="input-email"
          v-model="inputEmail"
          :filled="true"
          :class="{ 'is-invalid': inputEmailInvalid }"
          :disabled="useKeychain"
          placeholder="Enter e-mail"
        />
        <div v-if="inputEmailInvalid" data-testid="invalid-text-email" class="invalid-feedback">
          Invalid e-mail.
        </div>
      </div>

      <!-- Password -->
      <div :key="useKeychain.toString()">
        <label data-testid="label-password" class="form-label mt-4">Password</label>
        <AppPasswordInput
          v-model="inputPassword"
          :filled="true"
          :class="{ 'is-invalid': inputPasswordInvalid }"
          :disabled="useKeychain"
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

    <!-- Submit -->
    <div class="d-flex justify-content-between align-items-end mt-5">
      <div>
        <AppButton
          color="secondary"
          type="button"
          data-testid="button-migration-cancel"
          @click="handleCancel"
          >Cancel</AppButton
        >
      </div>
      <div>
        <AppButton
          color="primary"
          type="submit"
          class="w-100"
          loading-text="Migrating..."
          :loading="loading"
          :disabled="
            !useKeychain && (inputEmail.trim().length === 0 || inputPassword.trim().length === 0)
          "
          data-testid="button-setup-personal"
          >Continue</AppButton
        >
      </div>
    </div>
  </form>
</template>
