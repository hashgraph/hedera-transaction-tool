<script setup lang="ts">
import type { Organization } from '@prisma/client';
import type { GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

import { inject, onUpdated, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import { useToast } from 'vue-toast-notification';

import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

import { withLoader } from '@renderer/utils';

import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';
import AppButton from './ui/AppButton.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const createTooltips = useCreateTooltips();
const toast = useToast();

/* Injected */
const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

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

    if (user.selectedOrganization?.isServerActive) {
      defaultDropDownValue.value = organizationNickname;
    }
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

    const organizationNickname =
      user.organizations.find(org => org.id === organization.id)?.nickname || '';
    defaultDropDownValue.value = organizationNickname;
  }
};

/* Hooks */
onUpdated(() => {
  createTooltips();
});

watch(
  () => user.organizations,
  (current, prev) => {
    const lastAddedOrganization = user.organizations[user.organizations.length - 1];

    if (user.selectedOrganization?.isServerActive) {
      // Check if organization was added or removed
      if (current.length > prev.length) {
        selectedMode.value = lastAddedOrganization.id;

        const organizationNickname =
          user.organizations.find(org => org.id === lastAddedOrganization.id)?.nickname || '';
        defaultDropDownValue.value = organizationNickname;
      } else {
        selectedMode.value = user.selectedOrganization.id;

        defaultDropDownValue.value = user.selectedOrganization.nickname;
      }
    } else {
      defaultDropDownValue.value = 'My Transactions';
    }
  },
);

/* Watchers */
watch(
  () => user.selectedOrganization,
  current => {
    if (current) {
      selectedMode.value = current.id;
      defaultDropDownValue.value = current.nickname;
    } else {
      selectedMode.value = 'personal';
      defaultDropDownValue.value = 'My Transactions';
    }
  },
);
</script>
<template>
  <div class="d-flex align-items-centert">
    <div class="dropdown">
      <AppButton
        id="modeSelectorDropdown"
        color="secondary"
        data-testid="dropdown-select-mode"
        class="w-100 d-flex align-items-center justify-content-between"
        data-bs-toggle="dropdown"
        v-bind="$attrs"
        style="min-width: 200px"
        >{{ defaultDropDownValue }} <i class="bi bi-chevron-down ms-3"></i
      ></AppButton>
      <ul class="dropdown-menu w-100 mt-3">
        <li
          data-testid="dropdown-item-0"
          data-value="personal"
          class="dropdown-item cursor-pointer"
          @click="
            withLoader(
              handleUserModeChange.bind(null, $event),
              toast,
              globalModalLoaderRef,
              'Failed to select user mode',
            )()
          "
        >
          <span class="text-small">My Transactions</span>
        </li>
        <template v-for="(organization, index) in user.organizations" :key="organization.id">
          <li
            :data-testid="'dropdown-item-' + (index + 1)"
            class="dropdown-item cursor-pointer mt-3"
            @click="
              withLoader(
                handleUserModeChange.bind(null, $event),
                toast,
                globalModalLoaderRef,
                'Failed to select user mode',
              )()
            "
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
      data-testid="button-add-new-organization"
      data-bs-toggle="tooltip"
      data-bs-trigger="hover"
      data-bs-placement="bottom"
      data-bs-custom-class="wide-tooltip"
      data-bs-title="Add organization"
      ><i class="bi bi-plus-square"></i
    ></AppButton>

    <AddOrganizationModal
      v-if="addOrganizationModalShown"
      v-model:show="addOrganizationModalShown"
      @added="handleAddOrganization"
    />
  </div>
</template>
