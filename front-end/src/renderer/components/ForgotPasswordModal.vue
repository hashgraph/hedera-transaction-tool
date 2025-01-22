<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { resetPassword, setPassword, verifyReset } from '@renderer/services/organization';
import { updateOrganizationCredentials } from '@renderer/services/organizationCredentials';
import { comparePasswords } from '@renderer/services/userService';

import {
  getErrorMessage,
  isEmail,
  isLoggedOutOrganization,
  isPasswordStrong,
  isUserLoggedIn,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';
import OTPInput from '@renderer/components/OTPInput.vue';

/* Props */
const props = defineProps<{
  show: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const email = ref('');

const otpInputRef = ref<InstanceType<typeof OTPInput> | null>(null);
const otp = ref<{
  value: string;
  isValid: boolean;
} | null>(null);

const personalPassword = ref('');
const personalPasswordInvalid = ref(false);
const newPassword = ref('');
const newPasswordInvalid = ref(false);

const shouldEnterToken = ref(false);
const shouldSetNewPassword = ref(false);

const token = ref<string | null>(null);

const onOTPReceivedUnsubscribe = ref<() => void>();

/* Computed */
const isPrimaryButtonDisabled = computed(() => {
  if (!shouldEnterToken.value && !shouldSetNewPassword.value) {
    return !isEmail(email.value);
  } else if (!shouldSetNewPassword.value) {
    return !otp.value?.isValid;
  } else if (shouldSetNewPassword.value) {
    return (
      !isPasswordStrong(newPassword.value).result ||
      (isUserLoggedIn(user.personal) &&
        !user.personal.useKeychain &&
        personalPassword.value.length === 0)
    );
  }
  return true;
});

/* Handlers */
const handleSubmit = async () => {
  if (!shouldEnterToken.value && !shouldSetNewPassword.value) {
    handleEmailEnter();
  } else if (!shouldSetNewPassword.value) {
    handleTokenEnter();
  } else if (shouldSetNewPassword.value) {
    handleNewPassword();
  }
};

async function handleEmailEnter() {
  if (!isEmail(email.value)) throw new Error('Invalid email');
  if (!user.selectedOrganization) throw new Error('Please select organization');

  try {
    token.value = await resetPassword(user.selectedOrganization.serverUrl, email.value);

    shouldEnterToken.value = true;
    setTimeout(() => otpInputRef.value?.focus(), 100);
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to request password reset'));
  }
}

async function handleTokenEnter() {
  if (!otp.value?.value || !otp.value.isValid) throw new Error('Invalid OTP');
  if (!user.selectedOrganization) throw new Error('Please select organization');
  if (!token.value) throw new Error('OTP token is not set');

  try {
    token.value = await verifyReset(
      user.selectedOrganization.serverUrl,
      otp.value.value,
      token.value,
    );

    shouldEnterToken.value = false;
    shouldSetNewPassword.value = true;
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to verify OTP'));
  }
}

async function handleNewPassword() {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  if (!isLoggedOutOrganization(user.selectedOrganization))
    throw new Error('Please select organization');
  if (!token.value) throw new Error('OTP token is not set');

  if (!user.personal.useKeychain) {
    const isPasswordCorrect = await comparePasswords(user.personal.id, personalPassword.value);

    personalPasswordInvalid.value = !isPasswordCorrect;

    if (personalPasswordInvalid.value) {
      throw new Error('Incorrect personal password');
    }
  }

  if (newPasswordInvalid.value) throw new Error('Password must be at least 10 characters long');

  try {
    !user.personal.useKeychain && user.setPassword(personalPassword.value);
    await setPassword(user.selectedOrganization.serverUrl, newPassword.value, token.value);

    // Update organization credentials, if they exist.
    // If not, ignore as the password has already been submitted to the backend
    // and the user will now go through the process as if for the first time.
    await updateOrganizationCredentials(
      user.selectedOrganization.id,
      user.personal.id,
      undefined,
      newPassword.value,
      undefined,
      personalPassword.value,
    );

    emit('update:show', false);

    toast.success('Password changed successfully');
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to set new password'));
  }
}

function handleBlur(field: string, value: string) {
  if (field === 'newPassword') {
    newPasswordInvalid.value = !isPasswordStrong(value).result && value.length !== 0;
  }
}

/* Hooks */
onBeforeMount(async () => {
  onOTPReceivedUnsubscribe.value = window.electronAPI.local.deepLink.onOTPReceived(
    (token: string) => {
      otpInputRef.value?.setOTP(token);
    },
  );
});

onBeforeUnmount(() => {
  if (onOTPReceivedUnsubscribe.value) onOTPReceivedUnsubscribe.value();
});

/* Watchers */
watch(
  () => props.show,
  () => {
    email.value = '';
    shouldEnterToken.value = false;
    shouldSetNewPassword.value = false;
    otp.value = null;
    personalPassword.value = '';
    personalPasswordInvalid.value = false;
    newPassword.value = '';
    newPasswordInvalid.value = false;
  },
);

watch(personalPassword, () => {
  personalPasswordInvalid.value = false;
});

watch(newPassword, pass => {
  if (isPasswordStrong(pass).result || pass.length === 0) {
    newPasswordInvalid.value = false;
  }
});
</script>
<template>
  <AppModal
    v-if="show"
    :show="show"
    :class="{
      'common-modal': !shouldEnterToken,
      'medium-modal': shouldEnterToken,
    }"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="emit('update:show', false)"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'contact'" style="height: 160px" />
      </div>
      <form class="mt-3" @submit.prevent="handleSubmit">
        <h3 class="text-center text-title text-bold">
          {{ shouldSetNewPassword ? 'Set new password' : 'Forgot password' }}
        </h3>

        <Transition name="fade" mode="out-in">
          <div v-if="!shouldEnterToken && !shouldSetNewPassword">
            <p class="text-center text-small text-secondary mt-4">
              Enter email to recover your password
            </p>
            <div class="form-group mt-5 mb-4">
              <label class="form-label">Email</label>
              <AppInput v-model="email" size="small" type="email" :filled="true" />
            </div>
          </div>

          <div v-else-if="shouldEnterToken" class="my-4">
            <p class="text-center text-small text-secondary mb-4">
              Please enter the one time password, received in your email
            </p>
            <OTPInput ref="otpInputRef" @otp-changed="newOtp => (otp = newOtp)" />
            <div class="text-center mt-4">
              <AppButton color="secondary" class="mt-4" type="button" @click="handleEmailEnter"
                >Resend</AppButton
              >
            </div>
          </div>

          <div v-else-if="shouldSetNewPassword">
            <div class="mt-4">
              <AppPasswordInput
                v-if="isUserLoggedIn(user.personal) && !user.personal.useKeychain"
                v-model="personalPassword"
                :filled="true"
                :class="{ 'is-invalid': personalPasswordInvalid }"
                placeholder="Personal Password"
              />
              <div v-if="personalPasswordInvalid" class="invalid-feedback">
                Incorrect personal password
              </div>
            </div>
            <div class="mt-4">
              <AppPasswordInput
                v-model="newPassword"
                :filled="true"
                :class="{ 'is-invalid': newPasswordInvalid }"
                placeholder="New Password"
                @blur="handleBlur('newPassword', $event.target.value)"
              />
              <div v-if="newPasswordInvalid" class="invalid-feedback">Invalid password</div>
            </div>
          </div>
        </Transition>

        <hr class="separator my-5" />
        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="emit('update:show', false)"
            >Cancel</AppButton
          >
          <AppButton color="primary" :disabled="isPrimaryButtonDisabled" type="submit"
            >Continue</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
