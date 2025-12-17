<script setup lang="ts">
import { computed } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useVersionCheck from '@renderer/composables/useVersionCheck';

import { openExternal } from '@renderer/services/electronUtilsService';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

const user = useUserStore();
const { versionStatus, updateUrl, reset } = useVersionCheck();

const shown = computed(() => versionStatus.value === 'belowMinimum');

const handleDownload = () => {
  if (updateUrl.value) {
    openExternal(updateUrl.value);
  }
};

const handleLogout = () => {
  reset();
  user.logout();
};
</script>
<template>
  <AppModal
    :show="shown"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="modal-fit-content"
  >
    <div class="text-center p-4">
      <div>
        <i class="bi bi-exclamation-triangle-fill text-warning" style="font-size: 4rem"></i>
      </div>
      <h2 class="text-title text-semi-bold mt-4">Update Required</h2>
      <p class="text-small text-secondary mt-3">
        Your current version is no longer supported.<br />
        Please update to continue using the application.
      </p>

      <hr class="separator my-4" />

      <div class="d-flex gap-4 justify-content-center">
        <AppButton type="button" color="secondary" @click="handleLogout">Logout</AppButton>
        <AppButton type="button" color="primary" @click="handleDownload">
          <i class="bi bi-download me-2"></i>Download Update
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

