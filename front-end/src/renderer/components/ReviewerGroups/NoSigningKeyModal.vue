<script setup lang="ts">
import { useRouter } from 'vue-router';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Model */
const show = defineModel<boolean>('show', { required: true });

/* Composables */
const router = useRouter();

/* Handlers */
function handleGoToSettings() {
  show.value = false;
  router.push('/settings/keys');
}
</script>
<template>
  <AppModal v-model:show="show" :close-on-click-outside="false" class="common-modal">
    <div class="p-4">
      <div class="text-center">
        <AppCustomIcon :name="'error'" style="height: 160px" />
      </div>
      <h3 class="text-center text-title text-bold mt-3">No Signing Key Available</h3>
      <p class="text-center text-small text-secondary mt-4">
        This action must be signed with one of your keys, but none are available on this device.
      </p>
      <p class="text-center text-small text-secondary mt-4">
        Go to <code class="text-small">Settings</code>, import or restore your private key, then try
        again.
      </p>
      <hr class="separator my-5" />
      <div class="row mt-4">
        <div class="col-6">
          <AppButton color="borderless" type="button" class="w-100" @click="show = false"
            >Cancel</AppButton
          >
        </div>
        <div class="col-6 d-grid">
          <AppButton
            color="primary"
            type="button"
            data-testid="button-goto-settings-no-signing-key"
            @click="handleGoToSettings"
            >Go to Settings</AppButton
          >
        </div>
      </div>
    </div>
  </AppModal>
</template>
