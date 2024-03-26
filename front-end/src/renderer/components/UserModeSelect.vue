<script setup lang="ts">
import { ref } from 'vue';

import { Organization } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';

import { shouldSignInOrganization } from '@renderer/services/organizationCredentials';

import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';
import AddOrSelectModal from '@renderer/components/Organization/AddOrSelectModal.vue';
import SelectOrganizationModal from './Organization/SelectOrganizationModal.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const router = useRouter();

/* State */
const selectedMode = ref<string>('personal');
const addOrSelectModalShown = ref(false);
const addOrganizationModalShown = ref(false);
const selectOrganizationModalShown = ref(false);

/* Handlers */
const handleUserModeChange = async (e: Event) => {
  const selectEl = e.target as HTMLSelectElement;
  const newValue = selectEl.value;

  if (newValue === 'add_organization') {
    selectEl.value = selectedMode.value;
    addOrSelectModalShown.value = true;
  } else if (newValue === 'personal') {
    user.setActiveOrganization(null);
    user.setIsSigningInOrganization(false);
    router.push(router.previousPath ? { path: router.previousPath } : { name: 'transactions' });
  } else {
    user.setActiveOrganization(
      user.data.connectedOrganizations.find(org => org.id === newValue) || null,
    );
    await routeIfShouldLogin();
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
  user.setActiveOrganization(organization);

  if (!user.data.connectedOrganizations.some(org => org.id === organization.id)) {
    user.data.connectedOrganizations.push(organization);
  }
  selectedMode.value = organization.id;

  await routeIfShouldLogin();
};

/* Functions */
async function routeIfShouldLogin() {
  if (user.data.activeOrganization === null) return;

  const flag = await shouldSignInOrganization(user.data.id, user.data.activeOrganization.id);

  if (flag) {
    user.setIsSigningInOrganization(true);
    router.push({ name: 'organizationLogin' });
  }
}
</script>
<template>
  <div>
    <select
      class="form-select is-fill lh-base"
      :value="selectedMode"
      @change="handleUserModeChange"
    >
      <option value="personal">Personal User</option>
      <template v-for="organization in user.data.connectedOrganizations" :key="organization.id">
        <option :value="organization.id">
          {{ organization.nickname }}
        </option>
      </template>
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
