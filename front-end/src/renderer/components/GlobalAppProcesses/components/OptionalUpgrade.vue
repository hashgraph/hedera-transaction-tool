<script setup lang="ts">
import { computed } from 'vue';

import useVersionCheck from '@renderer/composables/useVersionCheck';

import { openExternal } from '@renderer/services/electronUtilsService';

import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

const { versionStatus, updateUrl, latestVersion, isDismissed, dismissOptionalUpdate } =
  useVersionCheck();

const shown = computed(
  () => versionStatus.value === 'updateAvailable' && !isDismissed(),
);

const handleUpdate = () => {
  if (updateUrl.value) {
    openExternal(updateUrl.value);
  }
  dismissOptionalUpdate();
};

const handleLater = () => {
  dismissOptionalUpdate();
};
</script>
<template>
  <AppModal :show="shown" :close-on-click-outside="false" class="modal-fit-content">
    <div class="text-center p-4">
      <div>
        <i class="bi bi-arrow-up-circle-fill text-primary" style="font-size: 4rem"></i>
      </div>
      <h2 class="text-title text-semi-bold mt-4">Update Available</h2>
      <p class="text-small text-secondary mt-3">
        A new version <span v-if="latestVersion" class="text-bold">({{ latestVersion }})</span> is
        available.<br />
        Would you like to update now?
      </p>

      <hr class="separator my-4" />

      <div class="d-flex gap-4 justify-content-center">
        <AppButton type="button" color="secondary" @click="handleLater">Later</AppButton>
        <AppButton type="button" color="primary" @click="handleUpdate">
          <i class="bi bi-download me-2"></i>Update Now
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>

