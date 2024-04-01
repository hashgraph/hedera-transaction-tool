<script setup lang="ts">
import { ref, watch } from 'vue';

import { Organization } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';

/* Stores */
const user = useUserStore();

/* State */
const selectElRef = ref<HTMLSelectElement | null>(null);
const selectedMode = ref<string>('personal');
const addOrganizationModalShown = ref(false);
const newOrganization = ref<Organization | null>(null);

/* Handlers */
const handleUserModeChange = async (e: Event) => {
  newOrganization.value = null;

  const selectEl = e.target as HTMLSelectElement;
  const newValue = selectEl.value;
  const org = user.organizations.find(org => org.id === newValue);

  if (newValue === 'add_organization') {
    selectEl.value = selectedMode.value;
    addOrganizationModalShown.value = true;
  } else if (newValue === 'personal') {
    selectedMode.value = 'personal';
    await user.selectOrganization(null);
  } else {
    selectedMode.value = org ? org.id : 'personal';
    await user.selectOrganization(
      org
        ? {
            id: org.id,
            nickname: org.nickname,
            serverUrl: org.serverUrl,
            key: org.key,
          }
        : null,
    );
  }
};

const handleSelectOrganization = async (organization: Organization) => {
  await user.selectOrganization(organization);

  if (user.selectedOrganization?.isServerActive) {
    const org = user.organizations.find(org => org.id === organization.id);
    if (!org) newOrganization.value = organization;
    selectedMode.value = organization.id;
  }
};

/* Watchers */
watch(
  () => user.selectedOrganization,
  async selectedOrganization => {
    if (!selectedOrganization) {
      selectedMode.value = 'personal';
      selectElRef.value?.value ? (selectElRef.value.value = selectedMode.value) : {};
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
      <template v-for="organization in user.organizations" :key="organization.id">
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
  </div>
</template>
