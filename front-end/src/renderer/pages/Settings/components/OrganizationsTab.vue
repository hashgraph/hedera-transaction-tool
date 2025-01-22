<script setup lang="ts">
import type { Organization } from '@prisma/client';

import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useWebsocketConnection from '@renderer/stores/storeWebsocketConnection';

import { useToast } from 'vue-toast-notification';

import { updateOrganization } from '@renderer/services/organizationsService';

import { assertUserLoggedIn, toggleAuthTokenInSessionStorage } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AddOrganizationModal from '@renderer/components/Organization/AddOrganizationModal.vue';

/* Stores */
const user = useUserStore();
const ws = useWebsocketConnection();

/* Composables */
const toast = useToast();

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
  toast.success('Connection deleted successfully');
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
    toast.error('Nickname cannot be empty');
  } else if (user.organizations.some(org => org.nickname === nickname)) {
    toast.error('Nickname already exists');
  } else {
    await updateOrganization(user.organizations[index].id, { nickname });
    user.organizations[index].nickname = nickname;
    await user.refetchOrganizations();
  }
};

const handleAddOrganization = async (organization: Organization) => {
  await user.refetchOrganizations();
  await user.selectOrganization(organization);
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
              <th></th>
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
                <td class="text-center">
                  <AppButton
                    size="small"
                    data-testid="button-delete-connection"
                    color="danger"
                    @click="handleDeleteConnection(organization.id)"
                    class="min-w-unset"
                    ><span class="bi bi-trash"></span
                  ></AppButton>
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
