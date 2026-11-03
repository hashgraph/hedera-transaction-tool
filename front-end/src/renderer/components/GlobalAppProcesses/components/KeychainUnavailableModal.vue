<script setup lang="ts">
import { ref } from 'vue';

import useSafeStorage from '@renderer/stores/storeSafeStorage';

import { relaunch } from '@renderer/services/electronUtilsService';

import { KEYCHAIN_UNAVAILABLE_MESSAGE } from '@shared/constants';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import ResetDataModal from '@renderer/components/modals/ResetDataModal.vue';

/* Stores */
const safeStorage = useSafeStorage();

/* State */
const isResetDataModalShown = ref(false);

/* Handlers */
// Fresh start so the user gets a new chance to grant keychain access
const handleDataReset = async () => await relaunch();
</script>

<template>
  <AppModal
    v-if="safeStorage.keychainUnavailable"
    :show="true"
    :close-on-escape="false"
    :close-on-click-outside="false"
    class="common-modal"
  >
    <div class="p-4">
      <h3 class="text-center text-title text-bold">Keychain access required</h3>
      <p class="text-center text-small text-secondary mt-4">
        {{ KEYCHAIN_UNAVAILABLE_MESSAGE }} The application can't be used until access is granted.
      </p>

      <hr class="separator my-5" />

      <div class="flex-between-centered gap-4">
        <AppButton
          type="button"
          color="danger"
          data-testid="button-keychain-unavailable-reset"
          @click="isResetDataModalShown = true"
          >Reset Data</AppButton
        >
        <AppButton
          type="button"
          color="primary"
          data-testid="button-keychain-unavailable-relaunch"
          @click="relaunch"
          >Relaunch</AppButton
        >
      </div>
    </div>
  </AppModal>
  <ResetDataModal v-model:show="isResetDataModalShown" @data:reset="handleDataReset" />
</template>
