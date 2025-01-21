<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';

import { isUserLoggedIn } from '@renderer/utils';

import AppSelect from '@renderer/components/ui/AppSelect.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const { get, set } = useDefaultOrganization();

/* State */
const defaultOrganizationId = ref<string>('');

/* Computed */
const listedItems = computed(() => {
  const organizations = user.organizations.map(org => ({ value: org.id, label: org.nickname }));
  return [{ value: '', label: 'None' }, ...organizations];
});

const handleUpdateDefaultOrganization = async (id: string) => {
  if (!isUserLoggedIn(user.personal)) return;

  await set(id || null);

  defaultOrganizationId.value = id;
};

/* Hooks */
onBeforeMount(async () => {
  if (isUserLoggedIn(user.personal)) {
    defaultOrganizationId.value = (await get()) || '';
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
