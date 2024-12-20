<script setup lang="ts">
import type { GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import useRecoveryPhraseHashMigrate from '@renderer/composables/useRecoveryPhraseHashMigrate';

import { loginLocal, registerLocal } from '@renderer/services/userService';
import { initializeUseKeychain } from '@renderer/services/safeStorageService';

import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

import { getErrorMessage, isEmail, isPasswordStrong, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';
import ResetDataModal from '@renderer/components/modals/ResetDataModal.vue';

/* Props */
const props = defineProps<{
  shouldRegister: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'data:reset', value: void): void;
  (event: 'update:shouldRegister', value: boolean): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const createTooltips = useCreateTooltips();
const { redirectIfRequiredKeysToMigrate } = useRecoveryPhraseHashMigrate();

/* Injected */
const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

/* State */
const inputEmail = ref('');
const inputPassword = ref('');
const inputConfirmPassword = ref('');
const buttonLoading = ref(false);

const inputEmailInvalid = ref(false);
const inputPasswordInvalid = ref(false);
const inputConfirmPasswordInvalid = ref(false);
const passwordRequirements = reactive({
  length: false,
  // lowercase: false,
  // uppercase: false,
  // number: false,
  // special: false,
});
const tooltipContent = ref('');
const keepLoggedIn = ref(false);
const isResetDataModalShown = ref(false);

/* Computed */
const isPrimaryButtonDisabled = computed(() => {
  // The button is disabled if the email is not valid,
  // or the password is not entered
  // of if registering, the password is not strong enough
  // or the confirm password does not match
  return (
    !isEmail(inputEmail.value) ||
    inputPassword.value.length === 0 ||
    (props.shouldRegister &&
      (!isPasswordStrong(inputPassword.value).result ||
        inputPassword.value !== inputConfirmPassword.value))
  );
});

/* Handlers */
const handleOnFormSubmit = async () => {
  if (
    props.shouldRegister &&
    !inputConfirmPasswordInvalid.value &&
    !inputEmailInvalid.value &&
    !inputPasswordInvalid.value
  ) {
    await initializeUseKeychain(false);

    buttonLoading.value = true;
    const { id, email } = await registerLocal(
      inputEmail.value.trim(),
      inputPassword.value,
      keepLoggedIn.value,
    );

    await user.login(id, email, false);
    await user.refetchOrganizations();

    if (isUserLoggedIn(user.personal)) {
      user.setPassword(inputPassword.value);
    }

    await router.push({ name: 'accountSetup' });
  } else if (!props.shouldRegister) {
    let userData: { id: string; email: string } | null = null;

    try {
      buttonLoading.value = true;
      userData = await loginLocal(
        inputEmail.value.trim(),
        inputPassword.value,
        keepLoggedIn.value,
        false,
      );
    } catch (error: any) {
      const message = getErrorMessage(error, 'Invalid email or password');
      const isInvalid = message.includes('email') || message.includes('password');
      inputEmailInvalid.value = isInvalid;
      inputPasswordInvalid.value = isInvalid;
    } finally {
      buttonLoading.value = false;
    }

    if (userData) {
      try {
        globalModalLoaderRef?.value?.open();
        await user.login(userData.id, userData.email.trim(), false);
        await user.refetchOrganizations();
        if (isUserLoggedIn(user.personal)) {
          user.setPassword(inputPassword.value);
        }

        if (user.secretHashes.length === 0) {
          await router.push({ name: 'accountSetup' });
        } else {
          if (await redirectIfRequiredKeysToMigrate()) {
            return;
          }

          await router.push(
            router.previousPath ? { path: router.previousPath } : { name: 'transactions' },
          );
        }
      } finally {
        buttonLoading.value = false;
        globalModalLoaderRef?.value?.close();
      }
    }
  }
};

const handleResetData = async () => {
  inputEmailInvalid.value = false;
  inputPasswordInvalid.value = false;
  inputConfirmPasswordInvalid.value = false;

  emit('data:reset');

  setTimeout(() => {
    createTooltips();
    setTooltipContent();
  }, 300);
};

const handleBlur = (inputType: string, value: string) => {
  // When any input loses focus, set its invalid state
  if (props.shouldRegister) {
    // If the value is empty, the user will expect it to be invalid and does
    // not need to see the warning
    const isEmpty = value.length === 0;
    if (inputType === 'email') {
      inputEmailInvalid.value = !isEmpty && !isEmail(value);
    } else if (inputType === 'inputPassword') {
      inputPasswordInvalid.value = !isEmpty && !isPasswordStrong(value).result;
    } else if (inputType === 'inputConfirmPassword') {
      inputConfirmPasswordInvalid.value = !isEmpty && value.trim() !== inputPassword.value?.trim();
    }
  }
};

/* Misc */
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
  passwordRequirements.length = isPasswordStrong(inputPassword.value).length;

  setTimeout(() => {
    createTooltips();
    setTooltipContent();
  }, 300);
});

/* Watchers */
watch(inputPassword, pass => {
  inputConfirmPasswordInvalid.value = false;
  if (props.shouldRegister) {
    const { result, length } = isPasswordStrong(pass);
    passwordRequirements.length = length;
    if (result || pass.length === 0) {
      inputPasswordInvalid.value = false;
    }
  } else {
    inputEmailInvalid.value = false;
    inputPasswordInvalid.value = false;
  }
  setTooltipContent();
});

watch(inputConfirmPassword, pass => {
  if (pass.trim() === inputPassword.value?.trim()) {
    inputConfirmPasswordInvalid.value = false;
  }
});

watch(inputEmail, pass => {
  if (props.shouldRegister) {
    if (isEmail(pass) || pass.length === 0) {
      inputEmailInvalid.value = false;
    }
  } else {
    inputEmailInvalid.value = false;
    inputPasswordInvalid.value = false;
  }
});
</script>

<template>
  <form @submit.prevent="handleOnFormSubmit" class="form-login mt-5 w-100">
    <label data-testid="label-email" class="form-label">Email</label>
    <AppInput
      data-testid="input-email"
      v-model="inputEmail"
      :filled="true"
      :class="{ 'is-invalid': inputEmailInvalid }"
      placeholder="Enter email"
      @blur="handleBlur('email', $event.target.value)"
    />
    <div v-if="inputEmailInvalid" data-testid="invalid-text-email" class="invalid-feedback">
      Invalid e-mail
    </div>
    <label data-testid="label-password" class="form-label mt-4">Password</label>
    <AppPasswordInput
      v-model="inputPassword"
      :filled="true"
      :class="{ 'is-invalid': inputPasswordInvalid }"
      placeholder="Enter password"
      :data-bs-toggle="shouldRegister ? 'tooltip' : ''"
      data-bs-animation="false"
      data-bs-placement="right"
      data-bs-custom-class="wide-xl-tooltip text-start"
      data-bs-html="true"
      data-bs-title="_"
      data-testid="input-password"
      @blur="handleBlur('inputPassword', $event.target.value)"
    />
    <div v-if="inputPasswordInvalid" data-testid="invalid-text-password" class="invalid-feedback">
      Invalid password
    </div>
    <template v-if="shouldRegister">
      <label data-testid="label-password-confirm" class="form-label mt-4">Confirm password</label>
      <AppPasswordInput
        v-model="inputConfirmPassword"
        :filled="true"
        type="password"
        :class="{ 'is-invalid': inputConfirmPasswordInvalid }"
        placeholder="Confirm password"
        data-testid="input-password-confirm"
        @blur="handleBlur('inputConfirmPassword', $event.target.value)"
      />
      <div
        v-if="inputConfirmPasswordInvalid"
        data-testid="invalid-text-password-not-match"
        class="invalid-feedback"
      >
        Password do not match
      </div>
    </template>

    <div class="flex-centered justify-content-between gap-3 mt-3">
      <div>
        <AppCheckBox
          v-model:checked="keepLoggedIn"
          name="keep_logged_in"
          label="Keep me logged in"
          data-testid="checkbox-remember"
        ></AppCheckBox>
      </div>
      <span
        v-if="!shouldRegister"
        @click="isResetDataModalShown = true"
        class="text-small link-primary cursor-pointer"
        data-testid="link-reset"
        >Reset account</span
      >
      <ResetDataModal v-model:show="isResetDataModalShown" @data:reset="handleResetData" />
    </div>

    <div class="row justify-content-end mt-5">
      <div class="d-grid">
        <AppButton
          data-testid="button-login"
          color="primary"
          type="submit"
          class="w-100"
          :loading="buttonLoading"
          :disabled="isPrimaryButtonDisabled"
          >{{ shouldRegister ? 'Sign up' : 'Sign in' }}</AppButton
        >
      </div>
    </div>
  </form>
</template>
