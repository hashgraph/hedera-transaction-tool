<script setup lang="ts">
import type { USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import { inject, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { useToast } from 'vue-toast-notification';

import { changePassword } from '@renderer/services/organization/auth';
import { updateOrganizationCredentials } from '@renderer/services/organizationCredentials';

import { USER_PASSWORD_MODAL_KEY } from '@renderer/providers';

import { isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Props */
const props = defineProps<{
  handleContinue: () => void;
}>();

/* Stores */
const user = useUserStore();
const contacts = useContactsStore();
const notifications = useNotificationsStore();

/* Composables */
const toast = useToast();

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

/* State */
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

const currentPasswordInvalid = ref(false);
const newPasswordInvalid = ref(false);
const inputConfirmPasswordInvalid = ref(false);

const isLoading = ref(false);

/* Handlers */
const handleFormSubmit = async (event: Event) => {
  event.preventDefault();

  await handleChangePassword();
};

const handleChangePassword = async () => {
  if (!isUserLoggedIn(user.personal)) throw new Error('User is not logged in');
  const personalPassword = user.getPassword();
  if (!personalPassword && !user.personal.useKeychain) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter personal password',
      'New password will be encrypted with this password',
      handleChangePassword,
    );
    return;
  }

  if (!isLoggedInOrganization(user.selectedOrganization)) {
    throw new Error('User is not logged in an organization.');
  }

  currentPasswordInvalid.value = currentPassword.value.trim().length === 0;
  newPasswordInvalid.value = newPassword.value.trim().length < 8;
  inputConfirmPasswordInvalid.value = newPassword.value !== confirmPassword.value;

  if (
    !currentPasswordInvalid.value &&
    !newPasswordInvalid.value &&
    !inputConfirmPasswordInvalid.value
  ) {
    try {
      isLoading.value = true;

      await changePassword(
        user.selectedOrganization.serverUrl,
        currentPassword.value,
        newPassword.value,
      );

      await updateOrganizationCredentials(
        user.selectedOrganization.id,
        user.personal.id,
        undefined,
        newPassword.value,
        undefined,
        personalPassword || undefined,
      );

      await user.refetchUserState();
      await contacts.fetch();
      await notifications.fetchPreferences();

      props.handleContinue();

      toast.success('Password changed successfully');
    } catch (err: any) {
      let message = 'Failed to change password';
      if (err.message && typeof err.message === 'string') {
        message = err.message;
      }
      toast.error(message);
    } finally {
      isLoading.value = false;
    }
  }
};

/* Watchers */
watch(confirmPassword, val => {
  if (val.length === 0 || newPassword.value === val) {
    inputConfirmPasswordInvalid.value = false;
  }
});
</script>

<template>
  <div class="fill-remaining flex-start flex-column mt-4">
    <h1 class="text-display text-bold text-center">New Password</h1>
    <p class="text-main text-center mt-5">Please enter new password</p>
    <form @submit="handleFormSubmit" class="row justify-content-center w-100 mt-5">
      <div class="col-12 col-md-8 col-lg-6">
        <AppInput
          v-model="currentPassword"
          :filled="true"
          :class="{ 'is-invalid': currentPasswordInvalid }"
          type="password"
          placeholder="Current Password"
        />
        <div v-if="currentPasswordInvalid" class="invalid-feedback">
          Current password is required.
        </div>
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
        <AppButton
          color="primary"
          size="large"
          type="submit"
          class="w-100 mt-5"
          :loading="isLoading"
          :disabled="newPassword.length === 0 || confirmPassword.length === 0"
          >Continue</AppButton
        >
      </div>
    </form>
  </div>
</template>
