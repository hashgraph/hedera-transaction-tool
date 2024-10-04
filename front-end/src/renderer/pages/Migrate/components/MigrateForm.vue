<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { encrypt, isKeychainAvailable } from '@renderer/services/safeStorageService';

import { isEmail, isPasswordStrong, isUrl } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Types */
export type ModelValue = {
  email: string;
  password: string;
  organizationURL: string;
  temporaryOrganizationPassword: string;
  recoveryPhrasePassword: string;
  useKeychain: boolean;
};

/* Props */
defineProps<{
  loading: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: ModelValue): void;
  (event: 'update:valid', value: boolean): void;
  (event: 'submit', value: ModelValue): void;
}>();

/* State */
const useKeychain = ref(false);

const inputEmail = ref('');
const inputPassword = ref('');
const inputOrganizationURL = ref('');
const inputTemporaryOrganizationPassword = ref('');
const inputRecoveryPhrasePassword = ref('');

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);
const inputOrganizationURLInvalid = ref(false);

const passwordRequirements = reactive({
  length: false,
});

const tooltipContent = ref('');

/* Composables */
const createTooltips = useCreateTooltips();

/* Handlers */
const handleOnFormSubmit = (e: Event) => {
  e.preventDefault();

  const email = inputEmail.value.trim();
  const password = inputPassword.value.trim();
  const organizationURL = inputOrganizationURL.value.trim();
  const temporaryOrganizationPassword = inputTemporaryOrganizationPassword.value.trim();
  const recoveryPhrasePassword = inputRecoveryPhrasePassword.value.trim();

  inputEmailInvalid.value = email.trim() === '' || !isEmail(email);
  inputPasswordInvalid.value = password.trim() === '' || !checkPassword(password);
  inputOrganizationURLInvalid.value = organizationURL.trim() === '' || !checkUrl(organizationURL);

  if (
    (useKeychain.value ? false : inputEmailInvalid.value || inputPasswordInvalid.value) ||
    inputOrganizationURLInvalid.value ||
    temporaryOrganizationPassword.length === 0 ||
    recoveryPhrasePassword.length === 0
  ) {
    return;
  }

  emit('submit', {
    email: email,
    password: password,
    organizationURL: organizationURL,
    temporaryOrganizationPassword: temporaryOrganizationPassword,
    recoveryPhrasePassword: recoveryPhrasePassword,
    useKeychain: useKeychain.value,
  });
};

const handleUseKeychain = async (value: boolean) => {
  inputEmail.value = '';
  inputPassword.value = '';
  inputEmailInvalid.value = false;
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

function checkUrl(url: string) {
  const urlValid = isUrl(url);
  if (urlValid) inputOrganizationURL.value = new URL(url).origin;
  return urlValid;
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
watch(inputOrganizationURL, url => {
  if (checkUrl(url) || url.length === 0) inputOrganizationURLInvalid.value = false;
});
</script>
<template>
  <form @submit="handleOnFormSubmit" class="flex-column-100">
    <div class="row fill-remaining">
      <div class="col-12 col-md-4 mt-5">
        <h4 class="text-subheader text-semi-bold text-center">Personal Info</h4>

        <label data-testid="label-email" class="form-label mt-4">Application authentication</label>

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

        <template v-if="!useKeychain">
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

      <hr class="separator mt-5 d-md-none" />

      <div class="col-12 col-md-4 mt-5">
        <h4 class="text-subheader text-semi-bold text-center">Organization</h4>

        <!-- Organization URL -->
        <div>
          <label data-testid="label-organization-url" class="form-label mt-4"
            >Organization URL</label
          >
          <AppInput
            data-testid="input-organization-url"
            v-model="inputOrganizationURL"
            :filled="true"
            :class="{ 'is-invalid': inputOrganizationURLInvalid }"
            placeholder="Enter organization URL"
          />
          <div
            v-if="inputOrganizationURLInvalid"
            data-testid="invalid-text-organization-url"
            class="invalid-feedback"
          >
            Invalid URL.
          </div>
        </div>

        <!-- Temporary Organization Password -->
        <div>
          <label data-testid="label-password" class="form-label mt-4"
            >Temporary Organization Password</label
          >
          <AppInput
            v-model="inputTemporaryOrganizationPassword"
            :filled="true"
            type="password"
            placeholder="Enter temporary organization password"
            data-testid="input-temporary-organization-password"
          />
        </div>
      </div>

      <hr class="separator mt-5 d-md-none" />

      <div class="col-12 col-md-4 mt-5">
        <h4 class="text-subheader text-semi-bold text-center">Old Tool</h4>

        <!-- Mnemonic Password -->
        <div>
          <label data-testid="label-password" class="form-label mt-4"
            >Recovery Phrase Decryption Password</label
          >
          <AppInput
            v-model="inputRecoveryPhrasePassword"
            :filled="true"
            type="password"
            placeholder="Enter recovery phrase decryption password"
            data-testid="input-recovery-phrase-decryption-password"
          />
        </div>
      </div>
    </div>

    <!-- Submit -->
    <div class="flex-1 d-flex flex-column justify-content-end mt-4">
      <div class="row justify-content-end">
        <div class="col-12 col-md-4">
          <AppButton
            data-testid="button-login"
            color="primary"
            type="submit"
            class="w-100"
            loading-text="Migrating..."
            :loading="loading"
            :disabled="
              (useKeychain
                ? false
                : inputEmail.trim().length === 0 || inputPassword.trim().length === 0) ||
              inputTemporaryOrganizationPassword.trim().length === 0 ||
              inputOrganizationURL.trim().length === 0 ||
              inputRecoveryPhrasePassword.trim().length === 0
            "
            >Continue</AppButton
          >
        </div>
      </div>
    </div>
  </form>
</template>
