<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import { UPDATE_LOCATION } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { add, getStoredClaim, update } from '@renderer/services/claimService';

import { isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import { showOpenDialog } from '@renderer/services/electronUtilsService';

/* Stores */
const user = useUserStore();

/* State */
const updateLocation = ref<string>('');

const handleSelectLocation = async () => {
  const answer = await showOpenDialog(
    'Select the location of app updates',
    'Select Folder',
    [],
    ['openDirectory'],
    'Select the location of app updates',
  );

  if (answer.canceled) return;

  await handleUpdateLocation(answer.filePaths[0]);
};

const handleUpdateLocation = async (location: string) => {
  location = location.trim();
  if (!isUserLoggedIn(user.personal)) return;

  const storedClaim = await getStoredClaim(user.personal.id, UPDATE_LOCATION);
  const addOrUpdate = storedClaim !== undefined ? update : add;

  await addOrUpdate(user.personal.id, UPDATE_LOCATION, location);

  updateLocation.value = location;
};

/* Functions */

/* Hooks */
onBeforeMount(async () => {
  if (isUserLoggedIn(user.personal)) {
    const storedUpdateLocation = await getStoredClaim(user.personal.id, UPDATE_LOCATION);

    if (storedUpdateLocation !== undefined) {
      updateLocation.value = storedUpdateLocation;
    }
  }
});
</script>
<template>
  <div class="mt-4">
    <div>
      <label class="form-label">Update Location</label>
      <div class="d-flex align-items-center gap-3">
        <div>
          <AppButton type="button" color="primary" @click="handleSelectLocation">Select</AppButton>
        </div>
        <div class="flex-1">
          <AppInput :model-value="updateLocation" disabled />
        </div>
      </div>
    </div>
  </div>
</template>
