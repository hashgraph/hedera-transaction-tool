<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { useToast } from 'vue-toast-notification';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { changePassword } from '@renderer/services/organization/auth';
import { updateOrganizationCredentials } from '@renderer/services/organizationCredentials';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  getErrorMessage,
  isPasswordStrong,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';

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
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const currentPassword = ref('');
const newPassword = ref('');

const currentPasswordInvalid = ref(false);
const newPasswordInvalid = ref(false);

const isLoading = ref(false);

/* Computed */
const isPrimaryButtonDisabled = computed(() => {
  return (
    currentPassword.value.length === 0 ||
    currentPasswordInvalid.value ||
    !isPasswordStrong(newPassword.value).result
  );
});

/* Handlers */
const handleFormSubmit = async (event: Event) => {
  event.preventDefault();

  await handleChangePassword();
};

const handleChangePassword = async () => {
  assertIsLoggedInOrganization(user.selectedOrganization);
  assertUserLoggedIn(user.personal);
  const personalPassword = getPassword(handleChangePassword, {
    subHeading: 'New password will be encrypted with this password',
  });
  if (passwordModalOpened(personalPassword)) return;

  if (!currentPasswordInvalid.value && !newPasswordInvalid.value) {
    try {
      isLoading.value = true;

      await changePassword(
        user.selectedOrganization.serverUrl,
        currentPassword.value,
        newPassword.value,
      );

      const isUpdated = await updateOrganizationCredentials(
        user.selectedOrganization.id,
        user.personal.id,
        undefined,
        newPassword.value,
        undefined,
        personalPassword || undefined,
      );

      if (!isUpdated) {
        throw new Error('User credentials for this organization not found');
      }

      await user.refetchUserState();
      await contacts.fetch();
      await notifications.fetchPreferences();

      props.handleContinue();

      toast.success('Password changed successfully');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to change password'));
    } finally {
      isLoading.value = false;
    }
  }
};

const handleBlur = (inputType: string, value: string) => {
  const isEmpty = value.length === 0;
  // When any input loses focus, set its invalid state
  if (inputType === 'currentPassword') {
    // For current password, it is invalid if empty and the user should see the message
    currentPasswordInvalid.value = isEmpty;
  } else if (inputType === 'newPassword') {
    // For new password, it is invalid if it is not strong, but don't show the message if it is empty
    // as the button is disabled anyway
    newPasswordInvalid.value = !isPasswordStrong(value).result && !isEmpty;
  }
};

/* Watchers */
watch(currentPassword, () => {
  currentPasswordInvalid.value = false;
});

watch(newPassword, pass => {
  if (isPasswordStrong(pass).result || pass.length === 0) {
    newPasswordInvalid.value = false;
  }
});
</script>

<template>
  <div class="fill-remaining flex-start flex-column mt-4">
    <h1 class="text-display text-bold text-center">New Password</h1>
    <p class="text-main text-center mt-5">Please enter new password</p>
    <form @submit="handleFormSubmit" class="row justify-content-center w-100 mt-5">
      <div class="col-12 col-md-8 col-lg-6">
        <AppPasswordInput
          v-model="currentPassword"
          :filled="true"
          :class="{ 'is-invalid': currentPasswordInvalid }"
          placeholder="Current Password"
          @blur="handleBlur('currentPassword', $event.target.value)"
        />
        <div v-if="currentPasswordInvalid" class="invalid-feedback">
          Current password is required.
        </div>
        <div class="mt-4">
          <AppPasswordInput
            v-model="newPassword"
            :filled="true"
            :class="{ 'is-invalid': newPasswordInvalid }"
            placeholder="New Password"
            @blur="handleBlur('newPassword', $event.target.value)"
          />
          <div v-if="newPasswordInvalid" class="invalid-feedback">Invalid password.</div>
        </div>
        <AppButton
          color="primary"
          size="large"
          type="submit"
          class="w-100 mt-5"
          :loading="isLoading"
          :disabled="isPrimaryButtonDisabled"
          >Continue</AppButton
        >
      </div>
    </form>
  </div>
</template>
