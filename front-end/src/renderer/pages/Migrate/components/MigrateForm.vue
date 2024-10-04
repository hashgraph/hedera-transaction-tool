<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';

import { isEmail, isPasswordStrong } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Types */
export type ModelValue = {
  email: string;
  password: string;
  organizationURL: string;
  temporaryOrganizationPassword: string;
  recoveryPhrasePassword: string;
};

/* Props */
// const props = defineProps<{
//   modelValue: ModelValue;
//   valid: boolean;
// }>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:modelValue', value: ModelValue): void;
  (event: 'update:valid', value: boolean): void;
  (event: 'submit', value: ModelValue): void;
}>();

/* State */
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
const toast = useToast();
const router = useRouter();
const createTooltips = useCreateTooltips();

/* Handlers */
const handleOnFormSubmit = (e: Event) => {
  e.preventDefault();

  inputEmailInvalid.value = inputEmail.value.trim() === '' || !isEmail(inputEmail.value);
  inputPasswordInvalid.value =
    inputPassword.value.trim() === '' || !checkPassword(inputPassword.value);
  try {
    const url = new URL(inputOrganizationURL.value);
    inputOrganizationURL.value = url.origin;
    inputOrganizationURLInvalid.value = false;
  } catch (error) {
    inputOrganizationURLInvalid.value = true;
  }

  emit('submit', {
    email: inputEmail.value,
    password: inputPassword.value,
    organizationURL: inputOrganizationURL.value,
    temporaryOrganizationPassword: inputTemporaryOrganizationPassword.value,
    recoveryPhrasePassword: inputRecoveryPhrasePassword.value,
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
onMounted(async () => {
  checkPassword(inputPassword.value);
  createTooltips();
  setTooltipContent();
});

/* Watchers */
watch(inputEmail, pass => {
  if (isEmail(pass) || pass.length === 0) inputEmailInvalid.value = false;
  setTooltipContent();
});
watch(inputPassword, pass => {
  if (checkPassword(pass) || pass.length === 0) inputPasswordInvalid.value = false;
});
</script>
<template>
  <form @submit="handleOnFormSubmit" class="flex-column-100">
    <div class="row fill-remaining">
      <div class="col-12 col-md-4 mt-5">
        <h4 class="text-subheader text-semi-bold text-center">Personal Info</h4>

        <!-- Email -->
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

        <!-- Password -->
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

      <div class="col-12 col-md-4 mt-5">
        <h4 class="text-subheader text-semi-bold text-center">Organization</h4>

        <!-- Organization URL -->
        <label data-testid="label-organization-url" class="form-label mt-4">Organization URL</label>
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

        <!-- Temporary Organization Password -->
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

      <div class="col-12 col-md-4 mt-5">
        <h4 class="text-subheader text-semi-bold text-center">Old Tool</h4>

        <!-- Mnemonic Password -->
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

    <!-- Submit -->
    <div class="flex-1 d-flex flex-column justify-content-end mt-4">
      <div class="row justify-content-end">
        <div class="col-12 col-md-4">
          <AppButton
            data-testid="button-login"
            color="primary"
            type="submit"
            class="w-100"
            :loading="false"
            :disabled="inputEmail.length === 0 || inputPassword.length === 0"
            >Continue</AppButton
          >
        </div>
      </div>
    </div>
  </form>
</template>
