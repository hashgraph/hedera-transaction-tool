<script setup lang="ts">
import {ref} from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import {useToast} from 'vue-toast-notification';

import {changeDecryptionPassword} from '@renderer/services/keyPairService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

/* Stores */
const user = useUserStore();
const keyPairsStore = useKeyPairsStore();

/* Composables */
const toast = useToast();

/* State */
const currentPassword = ref('');
const newPassword = ref('');

const isConfirmModalShown = ref(false);
const isSuccessModalShown = ref(false);

/* Handlers */
const handleChangePassword = async e => {
  e.preventDefault();
  isConfirmModalShown.value = false;
  try {
    if (!user.data.isLoggedIn) {
      throw new Error('User is not logged in');
    }

    if (currentPassword.value.length > 0 && newPassword.value.length > 0) {
      await changeDecryptionPassword(user.data.id, currentPassword.value, newPassword.value);

      await keyPairsStore.refetch();

      isSuccessModalShown.value = true;
    }
  } catch (err: any) {
    toast.error('Failed to change password', {position: 'bottom-right'});
  }
};
</script>
<template>
  <div>
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
          type="password"
          placeholder="Enter Current Password"
          :filled="true"
        />
      </div>
      <div class="mt-4 form-group">
        <label class="form-label">New Password <span class="text-danger">*</span></label>
        <AppInput
          v-model="newPassword"
          type="password"
          placeholder="Enter New Password"
          :filled="true"
        />
      </div>
      <div class="d-grid">
        <AppButton
          color="primary"
          type="submit"
          class="mt-4"
        >
          Change Password
        </AppButton>
      </div>
    </form>
    <AppModal
      v-model:show="isConfirmModalShown"
      class="common-modal"
    >
      <div class="modal-body">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          @click="isConfirmModalShown = false"
        ></i>
        <div class="text-center">
          <AppCustomIcon
            :name="'questionMark'"
            style="height: 160px"
          />
        </div>
        <h3 class="text-center text-title text-bold mt-4">Change Password?</h3>
        <p class="text-center text-small text-secondary mt-4">
          Are you sure you want to change your password
        </p>
        <hr class="separator my-5" />
        <div class="row mt-4">
          <div class="col-6">
            <AppButton
              class="w-100"
              @click="isConfirmModalShown = false"
            >
              Cancel
            </AppButton>
          </div>
          <div class="col-6">
            <AppButton
              color="primary"
              class="w-100"
              @click="handleChangePassword"
            >
              Change
            </AppButton>
          </div>
        </div>
      </div>
    </AppModal>
    <AppModal
      v-model:show="isSuccessModalShown"
      class="common-modal"
    >
      <form
        class="p-5"
        @submit="
          e => {
            e.preventDefault();
            isSuccessModalShown = false;
          }
        "
      >
        <div>
          <i
            class="bi bi-x-lg cursor-pointer"
            @click="isSuccessModalShown = false"
          ></i>
        </div>

        <div class="text-center">
          <AppCustomIcon
            :name="'success'"
            style="height: 130px"
          />
        </div>

        <h3 class="text-center text-title text-bold mt-3">Password Changed Successfully</h3>
        <div class="d-grid mt-5">
          <AppButton
            color="primary"
            type="submit"
          >
            Close
          </AppButton>
        </div>
      </form>
    </AppModal>
  </div>
</template>
