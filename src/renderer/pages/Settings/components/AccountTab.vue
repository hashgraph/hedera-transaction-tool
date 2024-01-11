<script setup lang="ts">
import { ref } from 'vue';

import useLocalUserStateStore from '../../../stores/storeLocalUserState';
import useKeyPairsStore from '../../../stores/storeKeyPairs';

import { useToast } from 'vue-toast-notification';

import { changeDecryptionPassword } from '../../../services/keyPairService';

import AppButton from '../../../components/ui/AppButton.vue';
import AppModal from '../../../components/ui/AppModal.vue';

/* Stores */
const localUserStateStore = useLocalUserStateStore();
const keyPairsStore = useKeyPairsStore();

/* Composables */
const toast = useToast();

/* State */
const currentPassword = ref('');
const newPassword = ref('');

const isSuccessModalShown = ref(false);

/* Handlers */
const handleChangePassword = async () => {
  try {
    if (!localUserStateStore.email) {
      throw new Error('User is not logged in');
    }

    if (currentPassword.value.length > 0 && newPassword.value.length > 0) {
      //SEND PASSWORD CHANGE REQUEST

      await changeDecryptionPassword(
        localUserStateStore.email,
        currentPassword.value,
        newPassword.value,
      );

      await keyPairsStore.refetch();

      isSuccessModalShown.value = true;
    }
  } catch (err: any) {
    let message = 'Failed to change password';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'top-right' });
  }
};
</script>
<template>
  <div>
    <div class="w-50 py-4 px-5 border rounded-4">
      <div class="form-group">
        <label class="form-label">Current Password</label>
        <input
          v-model="currentPassword"
          type="text"
          placeholder="Enter your current password"
          class="form-control rounded-4 py-3"
        />
      </div>
      <div class="mt-4 form-group">
        <label class="form-label" placeholder="Enter new password">New Password</label>
        <input
          v-model="newPassword"
          type="text"
          placeholder="Enter new password"
          class="form-control rounded-4 py-3"
        />
      </div>
      <AppButton color="secondary" class="mt-4 rounded-4" @click="handleChangePassword"
        >Change Password</AppButton
      >
    </div>
    <AppModal v-model:show="isSuccessModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSuccessModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-check-lg extra-large-icon cursor-pointer" style="line-height: 16px"></i>
        </div>

        <h3 class="mt-5 text-main text-center text-bold">Password Changed Successfully</h3>
        <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="isSuccessModalShown = false"
          >Close</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
