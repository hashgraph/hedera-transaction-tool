<script setup lang="ts">
import { ref, watch } from 'vue';

import { Organization } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { useRouter } from 'vue-router';

import { shouldSignInOrganization } from '@renderer/services/organizationCredentials';
import { getUserState } from '@renderer/services/organization';

import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';
import AddOrSelectModal from '@renderer/components/Organization/AddOrSelectModal.vue';
import SelectOrganizationModal from './Organization/SelectOrganizationModal.vue';

/* Stores */
const user = useUserStore();
const keyPairs = useKeyPairsStore();

/* Composables */
const router = useRouter();

/* State */
const selectElRef = ref<HTMLSelectElement | null>(null);
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
    selectedMode.value = newValue;
    user.setActiveOrganization(null);
    user.data.isSigningInOrganization = false;
    router.push(router.previousPath ? { path: router.previousPath } : { name: 'transactions' });
  } else {
    selectedMode.value = newValue;
    user.setActiveOrganization(
      user.data.connectedOrganizations.find(org => org.id === newValue) || null,
    );
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
};

/* Functions */
async function afterSelectOrganization() {
  if (user.data.activeOrganization === null) return;

  const flag = await shouldSignInOrganization(user.data.id, user.data.activeOrganization.id);

  if (flag) {
    user.data.isSigningInOrganization = true;
    router.push({ name: 'organizationLogin' });
    return;
  }

  const userState = await getUserState(user.data.activeOrganization.id, user.data.id);
  user.data.organizationState = userState;
  if (user.shouldSetupForOrganization(keyPairs.keyPairs)) {
    router.push({ name: 'accountSetup' });
    return;
  }
}

/* Watchers */
watch(
  () => user.data.organizationServerActive,
  async active => {
    if (!user.data.activeOrganization) {
      if (
        router.currentRoute.value.name === 'organizationLogin' ||
        router.currentRoute.value.name === 'accountSetup'
      ) {
        router.push(router.previousPath ? { path: router.previousPath } : { name: 'transactions' });
      } else {
        selectedMode.value = 'personal';
      }
      return;
    }

    if (!active) {
      // user.setActiveOrganization(null) in PingOrganizations
      selectedMode.value = 'personal';
      if (selectElRef.value) {
        selectElRef.value.value = selectedMode.value;
      }
      user.data.isSigningInOrganization = false;
      router.push(router.previousPath ? { path: router.previousPath } : { name: 'transactions' });
    } else {
      await afterSelectOrganization();
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
@renderer/services/organization/user
