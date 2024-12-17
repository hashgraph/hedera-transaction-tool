<script setup lang="ts">
import type { GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

import { computed, inject, onMounted, reactive, ref, watch } from 'vue';
import Tooltip from 'bootstrap/js/dist/tooltip';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import useSetDynamicLayout, { DEFAULT_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useRecoveryPhraseHashMigrate from '@renderer/composables/useRecoveryPhraseHashMigrate';

import { loginLocal, registerLocal, getUsersCount } from '@renderer/services/userService';

import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

import { getErrorMessage, isEmail, isPasswordStrong, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';
import ResetDataModal from '@renderer/components/modals/ResetDataModal.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();
const createTooltips = useCreateTooltips();
const { redirectIfRequiredKeysToMigrate } = useRecoveryPhraseHashMigrate();
useSetDynamicLayout(DEFAULT_LAYOUT);

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
const shouldRegister = ref(false);
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
    (shouldRegister.value &&
      (!isPasswordStrong(inputPassword.value).result ||
        inputPassword.value !== inputConfirmPassword.value))
  );
});

/* Handlers */
const handleOnFormSubmit = async (event: Event) => {
  event.preventDefault();

  if (
    shouldRegister.value &&
    !inputConfirmPasswordInvalid.value &&
    !inputEmailInvalid.value &&
    !inputPasswordInvalid.value
  ) {
    buttonLoading.value = true;
    const { id, email } = await registerLocal(
      inputEmail.value.trim(),
      inputPassword.value,
      keepLoggedIn.value,
    );

    await user.login(id, email, false);

    if (isUserLoggedIn(user.personal)) {
      user.setPassword(inputPassword.value);
    }

    router.push({ name: 'accountSetup' });
  } else if (!shouldRegister.value) {
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
        if (isUserLoggedIn(user.personal)) {
          user.setPassword(inputPassword.value);
        }

        if (user.secretHashes.length === 0) {
          router.push({ name: 'accountSetup' });
        } else {
          if (await redirectIfRequiredKeysToMigrate()) {
            return;
          }

          router.push(
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

  await checkShouldRegister();

  createTooltips();
  setTooltipContent();
};

const handleBlur = (inputType: string, value: string) => {
  // When any input loses focus, set its invalid state
  if (shouldRegister.value) {
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

/* Hooks */
onMounted(async () => {
  passwordRequirements.length = isPasswordStrong(inputPassword.value).length;
  await checkShouldRegister();
  if (shouldRegister.value) {
    createTooltips();
    setTooltipContent();
  }
});

/* Misc */
function setTooltipContent() {
  // tooltipContent.value = `
  //         <div class='d-flex flex-column align-items-start px-3'>
  //           <div class='${
  //             passwordRequirements.lowercase ? 'text-success' : 'text-danger'
  //           }'><i class='bi bi-${
  //             passwordRequirements.lowercase ? 'check' : 'x'
  //           }'></i>Lower case character</div>
  //           <div class='${
  //             passwordRequirements.uppercase ? 'text-success' : 'text-danger'
  //           }'><i class='bi bi-${
  //             passwordRequirements.uppercase ? 'check' : 'x'
  //           }'></i>Upper case character</div>
  //           <div class='${
  //             passwordRequirements.number ? 'text-success' : 'text-danger'
  //           }'><i class='bi bi-${passwordRequirements.number ? 'check' : 'x'}'></i>Have number</div>
  //           <div class='${
  //             passwordRequirements.special ? 'text-success' : 'text-danger'
  //           }'><i class='bi bi-${
  //             passwordRequirements.special ? 'check' : 'x'
  //           }'></i>Special character</div>
  //           <div class='${
  //             passwordRequirements.length ? 'text-success' : 'text-danger'
  //           }'><i class='bi bi-${
  //             passwordRequirements.length ? 'check' : 'x'
  //           }'></i>Be at least 10 characters</div>
  //         </div>
  //       `;

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

async function checkShouldRegister() {
  try {
    const usersCount = await getUsersCount();

    shouldRegister.value = usersCount < 2; /* 2 because the first user is the default */
  } catch {
    shouldRegister.value = true;
  }
}

/* Watchers */
watch(inputPassword, pass => {
  inputConfirmPasswordInvalid.value = false;
  if (shouldRegister.value) {
    if (isPasswordStrong(pass).result || pass.length === 0) {
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
  if (shouldRegister.value) {
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
  <div class="p-10 flex-column flex-centered flex-1 overflow-hidden" v-focus-first-input>
    <div class="container-dark-border glow-dark-bg p-5">
      <h4 class="text-title text-semi-bold text-center">
        {{ shouldRegister ? 'Register' : 'Sign In' }}
      </h4>
      <p class="text-secondary text-small lh-base text-center mt-3">
        {{ shouldRegister ? 'Enter e-mail and password' : 'Enter your e-mail and password' }}
      </p>

      <form @submit="handleOnFormSubmit" class="form-login mt-5 w-100">
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
          :show-icon="!shouldRegister"
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
        <div
          v-if="inputPasswordInvalid"
          data-testid="invalid-text-password"
          class="invalid-feedback"
        >
          Invalid password
        </div>
        <template v-if="shouldRegister">
          <label data-testid="label-password-confirm" class="form-label mt-4"
            >Confirm password</label
          >
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
              >{{ shouldRegister ? 'Next' : 'Sign in' }}</AppButton
            >
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
