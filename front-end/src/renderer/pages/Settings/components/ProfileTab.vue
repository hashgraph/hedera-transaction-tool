<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { changePassword } from '@renderer/services/userService';
import { changePassword as organizationChangePassword } from '@renderer/services/organization/auth';
import { updateOrganizationCredentials } from '@renderer/services/organizationCredentials';

import {
  assertUserLoggedIn,
  getErrorMessage,
  isLoggedInOrganization,
  isUserLoggedIn,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import ResetDataModal from '@renderer/components/modals/ResetDataModal.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const currentPassword = ref('');
const newPassword = ref('');

const isConfirmModalShown = ref(false);
const isSuccessModalShown = ref(false);
const isChangingPassword = ref(false);
const isResetDataModalShown = ref(false);

/* Handlers */
const handleChangePassword = async () => {
  try {
    isChangingPassword.value = true;

    assertUserLoggedIn(user.personal);

    if (currentPassword.value.length === 0 || newPassword.value.length === 0) {
      throw new Error('Password cannot be empty');
    }
    if (isLoggedInOrganization(user.selectedOrganization)) {
      const personalPassword = getPassword(handleChangePassword, {
        subHeading: 'Enter your application password to encrpyt your organization credentials',
      });
      if (passwordModalOpened(personalPassword)) return;

      await organizationChangePassword(
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
    } else {
      await changePassword(user.personal.id, currentPassword.value, newPassword.value);
      user.setPassword(newPassword.value);
      await user.refetchKeys();
    }

    isConfirmModalShown.value = false;
    isSuccessModalShown.value = true;

    await user.refetchAccounts();
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to change password'));
  } finally {
    isChangingPassword.value = false;
  }
};

const handleResetData = async () => router.push({ name: 'login' });
</script>
<template>
  <div
    v-if="
      (isUserLoggedIn(user.personal) && !user.personal.useKeychain) || user.selectedOrganization
    "
  >
    <form
      class="w-50 p-4 border rounded"
      @submit="
        e => {
          e.preventDefault();
          isConfirmModalShown = true;
        }
      "
    >
      <h3 class="text-main">Password</h3>
      <div class="form-group mt-4">
        <label class="form-label">Current Password <span class="text-danger">*</span></label>
        <AppInput
          v-model="currentPassword"
          data-testid="input-current-password"
          type="password"
          placeholder="Enter Current Password"
          :filled="true"
        />
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">New Password <span class="text-danger">*</span></label>
        <AppInput
          v-model="newPassword"
          data-testid="input-new-password"
          type="password"
          placeholder="Enter New Password"
          :filled="true"
        />
      </div>
      <div class="d-grid">
        <AppButton color="primary" data-testid="button-change-password" type="submit" class="mt-4"
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
</template>
