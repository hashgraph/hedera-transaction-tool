<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';

import { SELECTED_ORGANIZATION } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { add, getStoredClaim, update, remove } from '@renderer/services/claimService';

import { isUserLoggedIn, safeAwait } from '@renderer/utils';

import AppSelect from '@renderer/components/ui/AppSelect.vue';

/* Stores */
const user = useUserStore();

/* State */
const defaultOrganizationId = ref<string>('');

/* Computed */
const listedItems = computed(() => {
  const organizations = user.organizations.map(org => ({ value: org.id, label: org.nickname }));
  return [{ value: '', label: 'None' }, ...organizations];
});

const handleUpdateDefaultOrganization = async (id: string) => {
  if (!isUserLoggedIn(user.personal)) return;

  if (id) {
    const storedClaim = await getStoredClaim(user.personal.id, SELECTED_ORGANIZATION);
    const addOrUpdate = storedClaim !== undefined ? update : add;
    await addOrUpdate(user.personal.id, SELECTED_ORGANIZATION, id);
  } else {
    await remove(user.personal.id, [SELECTED_ORGANIZATION]);
  }

  defaultOrganizationId.value = id;
};

/* Hooks */
onBeforeMount(async () => {
  if (isUserLoggedIn(user.personal)) {
    const { data } = await safeAwait(getStoredClaim(user.personal.id, SELECTED_ORGANIZATION));

    if (data) {
      defaultOrganizationId.value = data;
    }
  }
});
</script>
<template>
  <div class="mt-4">
    <div class="col-sm-5 col-lg-4">
      <label class="form-label me-3">Default Organization</label>
      <AppSelect
        :value="defaultOrganizationId"
        @update:value="handleUpdateDefaultOrganization"
        :items="listedItems"
        toggle-text="Select Organization"
        toggler-icon
        :color="'secondary'"
        button-class="w-100"
      />
    </div>
  </div>
</template>
