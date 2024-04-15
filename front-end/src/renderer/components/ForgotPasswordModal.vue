<script setup lang="ts">
import { inject, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { resetPassword, setPassword, verifyReset } from '@renderer/services/organization';
import { addOrganizationCredentials } from '@renderer/services/organizationCredentials';

import { USER_PASSWORD_MODAL_KEY, USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import { isEmail } from '@renderer/utils';
import {
  isLoggedInWithPassword,
  isLoggedOutOrganization,
  isUserLoggedIn,
} from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
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

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

/* State */
const email = ref('');

const otpInputRef = ref<InstanceType<typeof OTPInput> | null>(null);
const otp = ref<{
  value: string;
  isValid: boolean;
} | null>(null);

const newPassword = ref('');
const confirmPassword = ref('');
const newPasswordInvalid = ref(false);
const inputConfirmPasswordInvalid = ref(false);

const shouldEnterToken = ref(false);
const shouldSetNewPassword = ref(false);

const onOTPReceivedUnsubscribe = ref<() => void>();

/* Handlers */
const handleSubmit = async (e: Event) => {
  e.preventDefault();

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
    await resetPassword(user.selectedOrganization.serverUrl, email.value);

    shouldEnterToken.value = true;
    setTimeout(() => otpInputRef.value?.focus(), 100);
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : 'Failed to request password reset');
  }
}

async function handleTokenEnter() {
  if (!otp.value?.value || !otp.value.isValid) throw new Error('Invalid OTP');
  if (!user.selectedOrganization) throw new Error('Please select organization');

  try {
    await verifyReset(user.selectedOrganization.serverUrl, otp.value.value);

    shouldEnterToken.value = false;
    shouldSetNewPassword.value = true;
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : 'Failed to verify OTP');
  }
}

async function handleNewPassword() {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  if (!isLoggedInWithPassword(user.personal)) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(null, null, handleNewPassword);
    return;
  }
  if (!isLoggedOutOrganization(user.selectedOrganization))
    throw new Error('Please select organization');

  newPasswordInvalid.value = newPassword.value.trim().length < 8;
  inputConfirmPasswordInvalid.value = newPassword.value !== confirmPassword.value;

  if (newPasswordInvalid.value) throw new Error('Password must be at least 8 characters long');
  if (inputConfirmPasswordInvalid.value) throw new Error('Passwords do not match');

  try {
    await setPassword(user.selectedOrganization.serverUrl, newPassword.value);

    await addOrganizationCredentials(
      email.value,
      newPassword.value,
      user.selectedOrganization.id,
      user.personal.id,
      user.personal.password,
      true,
    );

    emit('update:show', false);

    toast.success('Password changed successfully', { position: 'bottom-right' });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to set new password');
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
    newPassword.value = '';
    confirmPassword.value = '';
    newPasswordInvalid.value = false;
    inputConfirmPasswordInvalid.value = false;
  },
);
</script>
<template>
  <AppModal
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
      <form class="mt-3" @submit="handleSubmit">
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
              Please enter the one time password, received on your email
            </p>
            <OTPInput ref="otpInputRef" @otp-changed="newOtp => (otp = newOtp)" />
            <div class="text-center mt-4">
              <AppButton color="secondary" class="mt-4" type="button" @click="handleEmailEnter"
                >Resend</AppButton
              >
            </div>
          </div>

          <div v-else-if="shouldSetNewPassword">
            <AppInput
              v-model="newPassword"
              :filled="true"
              class="mt-4"
              :class="{ 'is-invalid': newPasswordInvalid }"
              type="password"
              placeholder="New Password"
            />
            <div v-if="newPasswordInvalid" class="invalid-feedback">Invalid password.</div>
            <AppInput
              v-model="confirmPassword"
              :filled="true"
              class="mt-4"
              :class="{ 'is-invalid': inputConfirmPasswordInvalid }"
              type="password"
              placeholder="Confirm New Password"
            />
            <div v-if="inputConfirmPasswordInvalid" class="invalid-feedback">
              Passwords do not match.
            </div>
          </div>
        </Transition>

        <hr class="separator my-5" />
        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" type="button" @click="emit('update:show', false)"
            >Cancel</AppButton
          >
          <AppButton color="primary" :disabled="email.length === 0" type="submit"
            >Continue</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
