<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';

import { HTX_USER } from '@shared/constants';

import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useLoader from '@renderer/composables/useLoader';

import { changePassword } from '@renderer/services/userService';
import { changePassword as organizationChangePassword } from '@renderer/services/organization/auth';
import { updateOrganizationCredentials } from '@renderer/services/organizationCredentials';
import { logout } from '@renderer/services/organization';

import {
  assertUserLoggedIn,
  getErrorMessage,
  isLoggedInOrganization,
  isPasswordStrong,
  isUserLoggedIn,
  toggleAuthTokenInSessionStorage,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppPasswordInput from '@renderer/components/ui/AppPasswordInput.vue';
import ResetDataModal from '@renderer/components/modals/ResetDataModal.vue';
import { errorToastOptions } from '@renderer/utils/toastOptions.ts';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const withLoader = useLoader();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const currentPassword = ref('');
const newPassword = ref('');
const currentPasswordInvalid = ref(false);
const newPasswordInvalid = ref(false);

const isConfirmModalShown = ref(false);
const isSuccessModalShown = ref(false);
const isChangingPassword = ref(false);
const isResetDataModalShown = ref(false);

/* Computed */
const isPrimaryButtonDisabled = computed(() => {
  return (
    currentPassword.value.length === 0 ||
    !isPasswordStrong(newPassword.value).result ||
    isChangingPassword.value
  );
});

/* Handlers */
const handleChangePassword = async () => {
  try {
    isChangingPassword.value = true;

    assertUserLoggedIn(user.personal);

    if (currentPassword.value.length === 0 || newPassword.value.length === 0) {
      throw new Error('Password cannot be empty');
    }

    if (newPasswordInvalid.value) throw new Error('Password must be at least 10 characters long');

    if (isLoggedInOrganization(user.selectedOrganization)) {
      const personalPassword = getPassword(handleChangePassword, {
        subHeading: 'Enter your application password to encrypt your organization credentials',
      });
      if (passwordModalOpened(personalPassword)) return;

      await organizationChangePassword(
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
        throw new Error('Failed to update organization credentials');
      }
    } else {
      await changePassword(user.personal.id, currentPassword.value, newPassword.value);
      user.setPassword(newPassword.value);
      await user.refetchKeys();
    }

    isConfirmModalShown.value = false;
    isSuccessModalShown.value = true;

    await user.refetchAccounts();
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to change password'), errorToastOptions);
  } finally {
    isChangingPassword.value = false;
  }
};

const handleResetData = async () => router.push({ name: 'login' });

const handleBlur = (inputType: string, value: string) => {
  if (inputType === 'newPassword') {
    newPasswordInvalid.value = value.length !== 0 && !isPasswordStrong(value).result;
  }
};

const handleLogout = async () => {
  if (user.selectedOrganization) {
    if (!isUserLoggedIn(user.personal)) return;

    const { id, nickname, serverUrl, key } = user.selectedOrganization;
    await logout(serverUrl);
    await updateOrganizationCredentials(id, user.personal.id, undefined, null, null);
    toggleAuthTokenInSessionStorage(serverUrl, '', true);
    await user.selectOrganization({ id, nickname, serverUrl, key });
  } else {
    localStorage.removeItem(HTX_USER);
    user.logout();
    await router.push({ name: 'login' });
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
  <div
    v-if="
      (isUserLoggedIn(user.personal) && !user.personal.useKeychain) || user.selectedOrganization
    "
  >
    <form class="w-50 p-4 border rounded" @submit.prevent="isConfirmModalShown = true">
      <h3 class="text-main">Password</h3>
      <div class="form-group mt-4">
        <label class="form-label">Current Password <span class="text-danger">*</span></label>
        <AppPasswordInput
          v-model="currentPassword"
          data-testid="input-current-password"
          placeholder="Enter Current Password"
          :filled="true"
        />
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">New Password <span class="text-danger">*</span></label>
        <AppPasswordInput
          v-model="newPassword"
          :filled="true"
          :class="{ 'is-invalid': newPasswordInvalid }"
          data-testid="input-new-password"
          placeholder="Enter New Password"
          @blur="handleBlur('newPassword', $event.target.value)"
        />
        <div v-if="newPasswordInvalid" class="invalid-feedback">Invalid password</div>
      </div>
      <div class="d-grid mt-4">
        <AppButton
          color="primary"
          data-testid="button-change-password"
          type="submit"
          :disabled="isPrimaryButtonDisabled"
          >Change Password</AppButton
        >
      </div>
    </form>
    <AppModal v-model:show="isConfirmModalShown" class="common-modal">
      <div class="p-4">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          @click="isConfirmModalShown = false"
        ></i>
        <div class="text-center">
          <AppCustomIcon :name="'questionMark'" style="height: 160px" />
        </div>
        <h3 class="text-center text-title text-bold mt-4">Change Password?</h3>
        <p class="text-center text-small text-secondary mt-4">
          Are you sure you want to change your password
        </p>
        <hr class="separator my-5" />
        <div class="flex-between-centered gap-4">
          <AppButton color="borderless" @click="isConfirmModalShown = false">Cancel</AppButton>
          <AppButton
            color="primary"
            data-testid="button-confirm-change-password"
            @click="handleChangePassword"
            :disabled="isChangingPassword"
            :loading="isChangingPassword"
            loading-text="Changing..."
            >Change</AppButton
          >
        </div>
      </div>
    </AppModal>
    <AppModal v-model:show="isSuccessModalShown" class="common-modal">
      <form class="p-5" @submit.prevent="isSuccessModalShown = false">
        <div>
          <i class="bi bi-x-lg cursor-pointer" @click="isSuccessModalShown = false"></i>
        </div>

        <div class="text-center">
          <AppCustomIcon :name="'success'" style="height: 130px" />
        </div>

        <h3 class="text-center text-title text-bold mt-3">Password Changed Successfully</h3>
        <div class="d-grid mt-5">
          <AppButton color="primary" data-testid="button-close" type="submit">Close</AppButton>
        </div>
      </form>
    </AppModal>
  </div>

  <div
    v-if="isUserLoggedIn(user.personal) && user.personal.useKeychain && !user.selectedOrganization"
  >
    <form class="w-50 p-4 border rounded" @submit.prevent="isResetDataModalShown = true">
      <h3 class="text-main">Reset Application</h3>

      <div class="d-grid">
        <AppButton color="primary" data-testid="button-change-password" type="submit" class="mt-4"
          >Reset</AppButton
        >
      </div>
    </form>
    <ResetDataModal v-model:show="isResetDataModalShown" @data:reset="handleResetData" />
  </div>

  <div
    v-if="
      (isUserLoggedIn(user.personal) && !user.personal.useKeychain && !user.selectedOrganization) ||
      isLoggedInOrganization(user.selectedOrganization)
    "
    class="mt-6"
  >
    <AppButton color="primary" data-testid="button-logout" @click="withLoader(handleLogout)">
      Log Out
    </AppButton>
  </div>
</template>
