<script setup lang="ts">
import type { Organization } from '@prisma/client';

import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';
import useOrganizationConnection from '@renderer/stores/storeOrganizationConnection';
import {
  getVersionStatusForOrg,
  getLatestVersionForOrg,
  organizationCompatibilityResults,
} from '@renderer/stores/versionState';

import { useToast } from 'vue-toast-notification';

import { updateOrganization } from '@renderer/services/organizationsService';

import {
  assertUserLoggedIn,
  isOrganizationActive,
  toggleAuthTokenInSessionStorage,
} from '@renderer/utils';

import useDefaultOrganization from '@renderer/composables/user/useDefaultOrganization';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';
import ConnectionStatusBadge from '@renderer/components/Organization/ConnectionStatusBadge.vue';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Stores */
const user = useUserStore();
const ws = useWebsocketConnection();
const orgConnection = useOrganizationConnection();

/* Composables */
const toast = useToast();
const { setLast } = useDefaultOrganization();

/* State */
const editedIndex = ref(-1);
const nicknameInputRef = ref<InstanceType<typeof AppInput>[] | null>(null);
const addOrganizationModalShown = ref(false);

/* Handlers */
const handleDeleteConnection = async (organizationId: string) => {
  assertUserLoggedIn(user.personal);

  const serverUrl = user.organizations.find(org => org.id === organizationId)?.serverUrl || '';
  ws.disconnect(serverUrl);
  toggleAuthTokenInSessionStorage(serverUrl, '', true);
  await user.selectOrganization(null);
  await user.deleteOrganization(organizationId);
  await setLast(null);
  toast.success('Connection deleted successfully', successToastOptions);
};

const handleStartNicknameEdit = (index: number) => {
  editedIndex.value = index;

  setTimeout(() => {
    if (nicknameInputRef.value && nicknameInputRef.value[index].inputRef) {
      try {
        nicknameInputRef.value[index].inputRef!.value = user.organizations[index].nickname;
      } catch {
        /* TS cannot guarantee that the value is not null */
      }

      nicknameInputRef.value[index].inputRef?.focus();
    }
  }, 100);
};

const handleChangeNickname = async (e: Event) => {
  assertUserLoggedIn(user.personal);

  const index = editedIndex.value;
  editedIndex.value = -1;

  const nickname = (e.target as HTMLInputElement)?.value?.trim() || '';

  if (nickname.length === 0) {
    toast.error('Nickname cannot be empty', errorToastOptions);
  } else if (user.organizations.some(org => org.nickname === nickname)) {
    toast.error('Nickname already exists', errorToastOptions);
  } else {
    await updateOrganization(user.organizations[index].id, { nickname });
    user.organizations[index].nickname = nickname;
  }
};

const handleAddOrganization = async (organization: Organization) => {
  await user.refetchOrganizations();
  await user.selectOrganization(organization);

  if (isOrganizationActive(user.selectedOrganization)) {
    await setLast(organization.id);
  }
};

/* Helpers */
const getConnectionStatus = (serverUrl: string) => {
  const storeStatus = orgConnection.getConnectionStatus(serverUrl);
  if (storeStatus) return storeStatus;

  const org = user.organizations.find(o => o.serverUrl === serverUrl);
  if (org?.connectionStatus) return org.connectionStatus;

  return ws.isLive(serverUrl) || ws.isConnected(serverUrl) ? 'connected' : 'disconnected';
};

const getDisconnectReason = (serverUrl: string) => {
  const storeReason = orgConnection.getDisconnectReason(serverUrl);
  if (storeReason) return storeReason;

  const org = user.organizations.find(o => o.serverUrl === serverUrl);
  return org?.disconnectReason;
};

const getVersionInfo = (serverUrl: string) => {
  const latestVersion = getLatestVersionForOrg(serverUrl);
  const versionStatus = getVersionStatusForOrg(serverUrl);
  return {
    latestVersion,
    versionStatus,
  };
};

const hasCompatibilityConflict = (serverUrl: string) => {
  const compatibilityResult = organizationCompatibilityResults.value[serverUrl];
  return compatibilityResult?.hasConflict || false;
};
</script>

<template>
  <div>
    <div class="fill-remaining">
      <div class="overflow-auto">
        <table v-if="user.organizations && user.organizations.length > 0" class="table-custom">
          <thead>
            <tr>
              <th>Nickname</th>
              <th>Server URL</th>
              <th>Status</th>
              <th>Version Info</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody class="text-secondary">
            <template v-for="(organization, i) in user.organizations" :key="organization.id">
              <tr>
                <td>
                  <div class="d-flex align-items-center flex-wrap gap-3">
                    <AppInput
                      class="min-w-unset"
                      data-testid="input-edit-nickname"
                      placeholder="Enter Nickname"
                      v-show="editedIndex === i"
                      ref="nicknameInputRef"
                      :filled="true"
                      @blur="handleChangeNickname"
                    />
                    <p
                      v-if="editedIndex === -1 || editedIndex !== i"
                      class="py-3"
                      @dblclick="handleStartNicknameEdit(i)"
                    >
                      <span class="text-truncate" data-testid="span-organization-nickname">
                        {{ organization.nickname }}
                      </span>

                      <span
                        class="bi bi-pencil-square text-primary ms-3 cursor-pointer"
                        data-testid="button-edit-nickname"
                        @click="handleStartNicknameEdit(i)"
                      ></span>
                    </p>
                  </div>
                </td>
                <td>
                  <p class="text-truncate">
                    {{ organization.serverUrl }}
                  </p>
                </td>
                <td>
                  <ConnectionStatusBadge
                    :status="getConnectionStatus(organization.serverUrl)"
                    :reason="getDisconnectReason(organization.serverUrl)"
                    :organization-name="organization.nickname"
                    :has-compatibility-conflict="hasCompatibilityConflict(organization.serverUrl)"
                  />
                  <p
                    v-if="getDisconnectReason(organization.serverUrl) === 'upgradeRequired'"
                    class="text-small text-warning mt-2 mb-0"
                  >
                    Update required to reconnect
                  </p>
                </td>
                <td>
                  <div class="d-flex flex-column gap-1">
                    <span
                      v-if="getVersionInfo(organization.serverUrl).latestVersion"
                      class="text-small"
                    >
                      Latest: {{ getVersionInfo(organization.serverUrl).latestVersion }}
                    </span>
                    <span
                      v-if="getVersionInfo(organization.serverUrl).versionStatus === 'belowMinimum'"
                      class="text-small text-warning"
                    >
                      Update Required
                    </span>
                    <span
                      v-else-if="
                        getVersionInfo(organization.serverUrl).versionStatus === 'updateAvailable'
                      "
                      class="text-small text-info"
                    >
                      Update Available
                    </span>
                    <span
                      v-else-if="getVersionInfo(organization.serverUrl).versionStatus === 'current'"
                      class="text-small text-success"
                    >
                      Current
                    </span>
                  </div>
                </td>
                <td>
                  <div class="d-flex align-items-center gap-2">
<!--                    <ConnectionToggle :organization="organization" />-->
                    <AppButton
                      size="small"
                      data-testid="button-delete-connection"
                      color="danger"
                      @click="handleDeleteConnection(organization.id)"
                      class="min-w-unset"
                      ><span class="bi bi-trash"></span
                    ></AppButton>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <template v-else>
          <div class="flex-centered flex-column text-center" v-bind="$attrs">
            <div>
              <span class="bi bi-people text-huge text-secondary"></span>
            </div>
            <div class="mt-3">
              <p class="text-title text-semi-bold">There are no connected organizations.</p>
            </div>
            <div class="mt-3">
              <AppButton class="text-main text-pink" @click="addOrganizationModalShown = true"
                >Connect now</AppButton
              >
            </div>
          </div>
          <AddOrganizationModal
            v-if="addOrganizationModalShown"
            v-model:show="addOrganizationModalShown"
            @added="handleAddOrganization"
          />
        </template>
      </div>
    </div>
  </div>
</template>
