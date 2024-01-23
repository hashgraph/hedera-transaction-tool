<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '../../../stores/storeUser';
import useKeyPairsStore from '../../../stores/storeKeyPairs';

import { useToast } from 'vue-toast-notification';

import { changeDecryptionPassword } from '../../../services/keyPairService';

import AppButton from '../../../components/ui/AppButton.vue';
import AppModal from '../../../components/ui/AppModal.vue';

/* Stores */
const user = useUserStore();
const keyPairsStore = useKeyPairsStore();

/* Composables */
const toast = useToast();

/* State */
const currentPassword = ref('');
const newPassword = ref('');

const isSuccessModalShown = ref(false);

/* Handlers */
const handleChangePassword = async e => {
  e.preventDefault();

  try {
    if (!user.data.isLoggedIn) {
      throw new Error('User is not logged in');
    }

    if (currentPassword.value.length > 0 && newPassword.value.length > 0) {
      await changeDecryptionPassword(user.data.email, currentPassword.value, newPassword.value);

      await keyPairsStore.refetch();

      isSuccessModalShown.value = true;
    }
  } catch (err: any) {
    toast.error('Failed to change password', { position: 'bottom-right' });
  }
};
</script>
<template>
  <div>
    <form class="w-50 py-4 px-5 border" @submit="handleChangePassword">
      <div class="form-group">
        <label class="form-label">Current Password</label>
        <input
          v-model="currentPassword"
          type="password"
          placeholder="Enter your current password"
          class="form-control is-fill py-3"
        />
      </div>
      <div class="mt-4 form-group">
        <label class="form-label" placeholder="Enter new password">New Password</label>
        <input
          v-model="newPassword"
          type="password"
          placeholder="Enter new password"
          class="form-control is-fill py-3"
        />
      </div>
      <AppButton color="secondary" type="submit" class="mt-4">Change Password</AppButton>
    </form>
    <AppModal v-model:show="isSuccessModalShown" class="common-modal">
      <form
        class="p-5"
        @submit="
          e => {
            e.preventDefault();
            isSuccessModalShown = false;
          }
        "
      >
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSuccessModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-lg extra-large-icon cursor-pointer" style="line-height: 16px"></i>
        </div>

        <h3 class="mt-5 text-main text-center text-bold">Password Changed Successfully</h3>
        <AppButton color="primary" type="submit" size="large" class="mt-5 w-100">Close</AppButton>
      </form>
    </AppModal>
  </div>
</template>
