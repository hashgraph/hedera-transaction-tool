<script setup lang="ts">
import { ref, onBeforeMount } from 'vue';

import { Organization } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { getOrganizations } from '@renderer/services/organizationsService';

import AddOrganizationModal from '@renderer/components/AddOrganizationModal.vue';

/* Stores */
const user = useUserStore();

/* State */
const organizations = ref<Organization[]>([]);
const selectedMode = ref<string>('personal');
const addOrganizationModalShown = ref(false);

/* Handlers */
const handleUserModeChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const newValue = selectEl.value;

  if (newValue === 'add_organization') {
    selectEl.value = selectedMode.value;
    addOrganizationModalShown.value = true;
  } else if (newValue === 'personal') {
    user.setActiveOrganization(null);
  } else {
    user.setActiveOrganization(organizations.value.find(org => org.id === newValue) || null);
  }
};

const handleAdded = (organization: Organization) => {
  organizations.value.push(organization);
};

/* Hooks */
onBeforeMount(async () => {
  organizations.value = await getOrganizations();
});
</script>
<template>
  <div>
    <select
      class="form-select is-fill lh-base"
      :value="selectedMode"
      @change="handleUserModeChange"
    >
      <option value="personal">Personal User</option>
      <template v-for="organization in organizations" :key="organization.id">
        <option :value="organization.id">
          {{ organization.nickname }}
        </option>
      </template>
      <option value="add_organization">Add Organization</option>
    </select>
    <AddOrganizationModal v-model:show="addOrganizationModalShown" @added="handleAdded" />
  </div>
</template>
