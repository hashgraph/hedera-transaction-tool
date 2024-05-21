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

/* Handlers */
const handleUserModeChange = async (e: Event) => {
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

const handleAddOrganization = async (organization: Organization) => {
  await user.refetchOrganizations();
  await user.selectOrganization(organization);

  if (user.selectedOrganization?.isServerActive) {
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
      <option value="personal">My Transactions</option>
      <template v-for="organization in user.organizations" :key="organization.id">
        <option :value="organization.id">
          {{ organization.nickname }}
        </option>
      </template>
      <option value="add_organization">Add Organization</option>
    </select>
    <AddOrganizationModal
      v-if="addOrganizationModalShown"
      v-model:show="addOrganizationModalShown"
      @added="handleAddOrganization"
    />
  </div>
</template>
