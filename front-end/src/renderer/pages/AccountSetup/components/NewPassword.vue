<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useContactsStore from '@renderer/stores/storeContacts';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { useToast } from 'vue-toast-notification';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { changePassword } from '@renderer/services/organization/auth';
import { updateOrganizationCredentials } from '@renderer/services/organizationCredentials';

import { assertIsLoggedInOrganization, assertUserLoggedIn, getErrorMessage, isPasswordStrong } from '@renderer/utils';

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

  currentPasswordInvalid.value = currentPassword.value.trim().length === 0;
  newPasswordInvalid.value = !isPasswordStrong(newPassword.value);

  if (
    !currentPasswordInvalid.value &&
    !newPasswordInvalid.value
  ) {
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

/* Watchers */
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
          />
          <div v-if="newPasswordInvalid" class="invalid-feedback">Invalid password.</div>
        </div>
        <AppButton
          color="primary"
          size="large"
          type="submit"
          class="w-100 mt-5"
          :loading="isLoading"
          :disabled="newPasswordInvalid || currentPasswordInvalid"
          >Continue</AppButton
        >
      </div>
    </form>
  </div>
</template>
