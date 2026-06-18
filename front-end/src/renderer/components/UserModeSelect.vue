<script setup lang="ts">
import type { Organization } from '@prisma/client';
import type { ConnectedOrganization } from '@renderer/types/userStore';

import { computed, onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import useLoader from '@renderer/composables/useLoader';
import useRecoveryPhraseHashMigrate from '@renderer/composables/useRecoveryPhraseHashMigrate';
import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';

import { isOrganizationActive, isUserLoggedIn } from '@renderer/utils';

import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Misc */
const personalModeText = 'Personal';

/* Stores */
const user = useUserStore();

/* Composables */
const withLoader = useLoader();
const { redirectIfRequiredKeysToMigrate } = useRecoveryPhraseHashMigrate();
const { setLast } = useDefaultOrganization();

/* State */
const selectedMode = ref<string>('personal');
const addOrganizationModalShown = ref(false);

/* Computed */
const dropDownValue = computed(() => {
  if (user.selectedOrganization) {
    return (
      user.organizations.find(o => o.id === user.selectedOrganization!.id)?.nickname ??
      user.selectedOrganization.nickname
    );
  }
  return personalModeText;
});

/* Handlers */
const handleUserModeChange = async (e: Event) => {
  const selectEl = e.currentTarget as HTMLSelectElement;
  const newValue = selectEl.getAttribute('data-value');

  if (newValue === selectedMode.value) return;

  const org = user.organizations.find(org => org.id === newValue);

  if (newValue === 'personal') {
    selectedMode.value = 'personal';
    await user.selectOrganization(null);
    await redirectIfRequiredKeysToMigrate();
    await setLast(null);
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

    if (isOrganizationActive(user.selectedOrganization)) {
      await setLast(user.selectedOrganization?.id || null);
    }

    await redirectIfRequiredKeysToMigrate();
  }
};

const handleAddOrganizationButtonClick = async () => {
  addOrganizationModalShown.value = true;
};

const handleAddOrganization = async (organization: Organization) => {
  await user.refetchOrganizations();
  await user.selectOrganization(organization);

  if (isOrganizationActive(user.selectedOrganization)) {
    selectedMode.value = organization.id;
    await setLast(organization.id);
  }
};

/* Functions */
const initialize = () => {
  selectedMode.value = user.selectedOrganization?.id ?? 'personal';
};

const getOrgEmail = (org: ConnectedOrganization): string | undefined => {
  if (!org.isLoading && org.isServerActive && !org.loginRequired) {
    return org.email;
  }
  return undefined;
};

/* Hooks */
onMounted(initialize);

watch(
  () => user.organizations,
  (current, prev) => {
    if (isOrganizationActive(user.selectedOrganization) && current.length > prev.length) {
      selectedMode.value = user.organizations[user.organizations.length - 1].id;
    }
  },
);

/* Watchers */
watch(() => user.selectedOrganization, initialize);
</script>
<template>
  <div class="d-flex align-items-center">
    <div class="dropdown">
      <AppButton
        id="modeSelectorDropdown"
        color="secondary"
        data-testid="dropdown-select-mode"
        class="w-100 d-flex align-items-center justify-content-between"
        data-bs-toggle="dropdown"
        v-bind="$attrs"
        style="min-width: 200px"
      >
        <div class="flex-centered gap-3 position-relative" data-testid="dropdown-selected-mode">
          {{ dropDownValue }}
        </div>
        <i class="bi bi-chevron-down ms-3"></i>
      </AppButton>
      <ul class="dropdown-menu dropdown-menu-sectioned mt-3" style="min-width: 280px">
        <li class="dropdown-header text-muted pe-none">Local</li>
        <li
          data-testid="dropdown-item-0"
          data-value="personal"
          class="dropdown-item py-2"
          :class="{ active: selectedMode === 'personal' }"
          @click="withLoader(handleUserModeChange.bind(null, $event), 'Failed to select user mode')"
        >
          <div class="text-truncate">
            {{
              isUserLoggedIn(user.personal) && !user.personal.useKeychain
                ? user.personal.email
                : personalModeText
            }}
          </div>
        </li>
        <template v-if="user.organizations.length">
          <li><hr class="dropdown-divider" /></li>
          <li class="dropdown-header text-muted pe-none">Organizations</li>
          <template v-for="(organization, index) in user.organizations" :key="organization.id">
            <li
              :data-testid="'dropdown-item-' + (index + 1)"
              class="dropdown-item py-2"
              :class="{ active: selectedMode === organization.id }"
              @click="
                withLoader(handleUserModeChange.bind(null, $event), 'Failed to select user mode')
              "
              :data-value="organization.id"
            >
              <div class="d-flex align-items-center gap-2">
                <div class="flex-grow-1" style="min-width: 0">
                  <div class="text-truncate">{{ organization.nickname }}</div>
                  <div v-if="getOrgEmail(organization)" class="text-muted small text-truncate ps-2">
                    {{ getOrgEmail(organization) }}
                  </div>
                </div>
                <div v-if="organization.isLoading" class="flex-centered">
                  <span class="text-primary spinner-border spinner-border-sm"></span>
                </div>
              </div>
            </li>
          </template>
        </template>
      </ul>
    </div>

    <AppButton
      class="ms-4 min-w-unset ws-no-wrap text-title"
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
