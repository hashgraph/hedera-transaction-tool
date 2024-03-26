<script setup lang="ts">
import { ref, onBeforeMount } from 'vue';

import { Organization } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { getOrganizations } from '@renderer/services/organizationsService';

import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';
import AddOrSelectModal from '@renderer/components/Organization/AddOrSelectModal.vue';
import SelectOrganizationModal from './Organization/SelectOrganizationModal.vue';

/* Stores */
const user = useUserStore();

/* State */
const organizations = ref<Organization[]>([]);
const selectedMode = ref<string>('personal');
const addOrSelectModalShown = ref(false);
const addOrganizationModalShown = ref(false);
const selectOrganizationModalShown = ref(false);

/* Handlers */
const handleUserModeChange = (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const newValue = selectEl.value;

  if (newValue === 'add_organization') {
    selectEl.value = selectedMode.value;
    addOrSelectModalShown.value = true;
  } else if (newValue === 'personal') {
    user.setActiveOrganization(null);
  } else {
    user.setActiveOrganization(organizations.value.find(org => org.id === newValue) || null);
  }
};

const handleSelectedOrAdd = (value: 'select' | 'add') => {
  addOrSelectModalShown.value = false;
  switch (value) {
    case 'select':
      return (selectOrganizationModalShown.value = true);
    case 'add':
      return (addOrganizationModalShown.value = true);
  }
};

const handleSelectOrganization = (organization: Organization) => {
  user.setActiveOrganization(organization);
  organizations.value.push(organization);
  selectedMode.value = organization.id;
};

/* Hooks */
onBeforeMount(async () => {
  organizations.value = await getOrganizations(user.data.id);
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
    <AddOrganizationModal
      v-model:show="addOrganizationModalShown"
      @added="handleSelectOrganization"
    />
    <SelectOrganizationModal
      v-model:show="selectOrganizationModalShown"
      @on-selected="handleSelectOrganization"
    />
    <AddOrSelectModal v-model:show="addOrSelectModalShown" @on-selected="handleSelectedOrAdd" />
  </div>
</template>
