<script setup lang="ts">
import { ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { isUserLoggedIn } from '@renderer/utils/userStoreHelpers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import { updateOrganization } from '@renderer/services/organizationsService';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* State */
const editedIndex = ref(-1);
const nicknameInputRef = ref<InstanceType<typeof AppInput>[] | null>(null);

/* Handlers */
const handleDeleteConnection = async (organizationId: string) => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

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

const handleChangeNickname = async e => {
  if (!isUserLoggedIn(user.personal)) {
    throw new Error('User is not logged in');
  }

  const index = editedIndex.value;
  editedIndex.value = -1;

  const nickname = e.target?.value?.trim() || '';

  if (nickname.length === 0) {
    toast.error('Nickname cannot be empty');
  } else {
    await updateOrganization(user.organizations[index].id, { nickname });
    user.organizations[index].nickname = nickname;
    await user.refetchOrganizations();
  }
};
</script>
<template>
  <div>
    <div class="fill-remaining">
      <div class="overflow-auto">
        <table class="table-custom">
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
                      <span class="text-truncate">
                        {{ organization.nickname }}
                      </span>

                      <span
                        class="bi bi-pencil-square text-primary ms-3 cursor-pointer"
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
      </div>
    </div>
  </div>
</template>
