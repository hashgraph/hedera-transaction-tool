<script setup lang="ts">
import type { Organization } from '@prisma/client';
import type { INotificationReceiver } from '@main/shared/interfaces';

import { computed, onMounted, onUpdated, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import useLoader from '@renderer/composables/useLoader';
import useCreateTooltips from '@renderer/composables/useCreateTooltips';
import useRecoveryPhraseHashMigrate from '@renderer/composables/useRecoveryPhraseHashMigrate';
import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';

import { isOrganizationActive } from '@renderer/utils';

import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';

/* Misc */
const personalModeText = 'Personal';

/* Stores */
const user = useUserStore();
const notifications = useNotificationsStore();

/* Composables */
const withLoader = useLoader();
const createTooltips = useCreateTooltips();
const { redirectIfRequiredKeysToMigrate } = useRecoveryPhraseHashMigrate();
const { setLast } = useDefaultOrganization();

/* State */
const selectedMode = ref<string>('personal');
const addOrganizationModalShown = ref(false);
const dropDownValue = ref<string>(personalModeText);

/* Computed */
const indicatorNotifications = computed<{ [key: string]: INotificationReceiver[] }>(() => {
  const allNotifications = { ...notifications.notifications };
  for (const serverUrl of Object.keys(allNotifications)) {
    allNotifications[serverUrl] = allNotifications[serverUrl].filter(n =>
      n.notification.type.toLocaleLowerCase().includes('indicator'),
    );
  }
  return allNotifications;
});

/* Handlers */
const handleUserModeChange = async (e: Event) => {
  const selectEl = e.currentTarget as HTMLSelectElement;
  const newValue = selectEl.getAttribute('data-value');
  const org = user.organizations.find(org => org.id === newValue);

  if (newValue === 'personal') {
    selectedMode.value = 'personal';
    dropDownValue.value = personalModeText;
    await user.selectOrganization(null);
    await redirectIfRequiredKeysToMigrate();
    await setLast(null);
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

    if (isOrganizationActive(user.selectedOrganization)) {
      dropDownValue.value = organizationNickname;
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

    const organizationNickname =
      user.organizations.find(org => org.id === organization.id)?.nickname || '';
    dropDownValue.value = organizationNickname;
  }
};

/* Functions */
const initialize = () => {
  if (user.selectedOrganization) {
    selectedMode.value = user.selectedOrganization.id;
    dropDownValue.value = user.selectedOrganization.nickname;
  } else {
    selectedMode.value = 'personal';
    dropDownValue.value = personalModeText;
  }
};

/* Hooks */
onMounted(initialize);

onUpdated(() => {
  createTooltips();
});

watch(
  () => user.organizations,
  (current, prev) => {
    const lastAddedOrganization = user.organizations[user.organizations.length - 1];

    if (isOrganizationActive(user.selectedOrganization)) {
      // Check if organization was added or removed
      if (current.length > prev.length) {
        selectedMode.value = lastAddedOrganization.id;

        const organizationNickname =
          user.organizations.find(org => org.id === lastAddedOrganization.id)?.nickname || '';
        dropDownValue.value = organizationNickname;
      } else {
        selectedMode.value = user.selectedOrganization.id;

        dropDownValue.value = user.selectedOrganization.nickname;
      }
    } else {
      dropDownValue.value = personalModeText;
    }
  },
);

/* Watchers */
watch(() => user.selectedOrganization, initialize);
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
      >
        <div
          class="flex-centered gap-3 position-relative"
          data-testid="dropdown-selected-mode"
          :class="{
            'indicator-circle-before': Object.values(indicatorNotifications).flat().length > 0,
          }"
        >
          {{ dropDownValue }}
        </div>
        <i class="bi bi-chevron-down ms-3"></i>
      </AppButton>
      <ul class="dropdown-menu w-100 mt-3">
        <li class="dropdown-header text-muted">Organizations</li>
        <li
          data-testid="dropdown-item-0"
          data-value="personal"
          class="dropdown-item"
          @click="withLoader(handleUserModeChange.bind(null, $event), 'Failed to select user mode')"
        >
          <span class="text-small">{{ personalModeText }}</span>
        </li>
        <template v-for="(organization, index) in user.organizations" :key="organization.id">
          <li
            :data-testid="'dropdown-item-' + (index + 1)"
            class="dropdown-item flex-between-centered gap-3 mt-3"
            @click="
              withLoader(handleUserModeChange.bind(null, $event), 'Failed to select user mode')
            "
            :data-value="organization.id"
          >
            <div
              class="position-relative flex-1 col-10"
              :class="{
                'indicator-circle-before':
                  (indicatorNotifications[organization.serverUrl] || []).length > 0,
              }"
            >
              <div class="text-small text-truncate">{{ organization.nickname }}</div>
            </div>

            <div v-if="organization.isLoading" class="flex-centered col-2">
              <span class="text-primary spinner-border spinner-border-sm"></span>
            </div>
          </li>
        </template>
      </ul>
    </div>

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
