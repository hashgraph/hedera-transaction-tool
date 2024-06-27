<script setup lang="ts">
import { ref } from 'vue';

import { Organization } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';
import AppButton from './ui/AppButton.vue';

/* Stores */
const user = useUserStore();

/* State */
const selectedMode = ref<string>('personal');
const addOrganizationModalShown = ref(false);
const defaultDropDownValue = ref<string>('My Transactions');

/* Handlers */
const handleUserModeChange = async (e: Event) => {
  const selectEl = e.currentTarget as HTMLSelectElement;
  const newValue = selectEl.getAttribute('data-value');
  const org = user.organizations.find(org => org.id === newValue);

  if (newValue === 'personal') {
    selectedMode.value = 'personal';
    defaultDropDownValue.value = 'My Transactions';
    await user.selectOrganization(null);
  } else {
    selectedMode.value = org ? org.id : 'personal';
    const organizationNickname =
      user.organizations.find(org => org.id === newValue)?.nickname || '';
    defaultDropDownValue.value = organizationNickname;

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

const handleAddOrganizationButtonClick = async () => {
  addOrganizationModalShown.value = true;
};

const handleAddOrganization = async (organization: Organization) => {
  await user.refetchOrganizations();
  await user.selectOrganization(organization);

  if (user.selectedOrganization?.isServerActive) {
    selectedMode.value = organization.id;
  }
};
</script>
<template>
  <div class="d-flex align-items-centert">
    <div class="dropdown">
      <AppButton
        id="modeSelectorDropdown"
        color="secondary"
        data-testid=""
        class="w-100 d-flex align-items-center justify-content-between"
        data-bs-toggle="dropdown"
        v-bind="$attrs"
        >{{ defaultDropDownValue }} <i class="bi bi-chevron-down ms-3"></i
      ></AppButton>
      <ul class="dropdown-menu w-100 mt-3">
        <li
          data-testid=""
          data-value="personal"
          class="dropdown-item cursor-pointer"
          @click="handleUserModeChange"
        >
          <span class="text-small">My Transactions</span>
        </li>
        <template v-for="organization in user.organizations" :key="organization.id">
          <li
            data-testid=""
            class="dropdown-item cursor-pointer mt-3"
            @click="handleUserModeChange"
            :data-value="organization.id"
          >
            <span class="text-small">{{ organization.nickname }}</span>
          </li>
        </template>
      </ul>
    </div>
    <!-- <select
      ref="selectElRef"
      class="form-select with-border is-fill lh-base"
      :value="selectedMode"
      @change="handleUserModeChange"
    >
      <option value="personal">My Transactions</option>
      <template v-for="organization in user.organizations" :key="organization.id">
        <option :value="organization.id">
          {{ organization.nickname }}
        </option>
      </template>
    </select> -->
    <AppButton
      class="ms-3 min-w-unset ws-no-wrap text-title"
      color="secondary"
      size="small"
      @click="handleAddOrganizationButtonClick"
      ><i class="bi bi-cloud-plus"></i
    ></AppButton>

    <AddOrganizationModal
      v-if="addOrganizationModalShown"
      v-model:show="addOrganizationModalShown"
      @added="handleAddOrganization"
    />
  </div>
</template>
