<script setup lang="ts">
import { ref, watch } from 'vue';

import { Organization } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';
import AddOrSelectModal from '@renderer/components/Organization/AddOrSelectModal.vue';
import SelectOrganizationModal from './Organization/SelectOrganizationModal.vue';

/* Stores */
const user = useUserStore();

/* State */
const selectElRef = ref<HTMLSelectElement | null>(null);
const selectedMode = ref<string>('personal');
const addOrSelectModalShown = ref(false);
const addOrganizationModalShown = ref(false);
const selectOrganizationModalShown = ref(false);
const newOrganization = ref<Organization | null>(null);

/* Handlers */
const handleUserModeChange = async (e: Event) => {
  newOrganization.value = null;

  const selectEl = e.target as HTMLSelectElement;
  const newValue = selectEl.value;
  const org = user.organizations.find(org => org.id === newValue);

  if (newValue === 'add_organization') {
    selectEl.value = selectedMode.value;
    addOrSelectModalShown.value = true;
  } else if (newValue === 'personal') {
    user.selectOrganization(null);
  } else {
    if (!org) {
      user.selectOrganization(null);
    } else {
      user.selectOrganization({
        id: org.id,
        nickname: org.nickname,
        serverUrl: org.serverUrl,
        key: org.key,
      });
    }
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

const handleSelectOrganization = async (organization: Organization) => {
  user.selectOrganization(organization);
  const org = user.organizations.find(org => org.id === organization.id);
  if (!org) newOrganization.value = organization;
  selectedMode.value = organization.id;
};

/* Watchers */
watch(
  () => user.selectedOrganization,
  async selectedOrganization => {
    if (!selectedOrganization) {
      newOrganization.value = null;
      selectedMode.value = 'personal';
    }
  },
);
</script>
<template>
  <div>
    <select
      ref="selectElRef"
      class="form-select is-fill lh-base"
      :value="selectedMode"
      @change="handleUserModeChange"
    >
      <option value="personal">Personal User</option>
      <template v-for="organization in [...user.organizations]" :key="organization.id">
        <option :value="organization.id">
          {{ organization.nickname }}
        </option>
      </template>

      <option v-if="newOrganization" :value="newOrganization.id">
        {{ newOrganization.nickname }}
      </option>

      <option value="add_organization">Add Organization</option>
    </select>
    <AddOrganizationModal
      v-if="addOrganizationModalShown"
      v-model:show="addOrganizationModalShown"
      @added="handleSelectOrganization"
    />
    <SelectOrganizationModal
      v-if="selectOrganizationModalShown"
      v-model:show="selectOrganizationModalShown"
      @on-selected="handleSelectOrganization"
    />
    <AddOrSelectModal
      v-if="addOrSelectModalShown"
      v-model:show="addOrSelectModalShown"
      @on-selected="handleSelectedOrAdd"
    />
  </div>
</template>
