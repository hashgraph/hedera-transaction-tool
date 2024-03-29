<script setup lang="ts">
import useUserStore from '@renderer/stores/storeUser';

import { useToast } from 'vue-toast-notification';

import { deleteOrganizationCredentials } from '@renderer/services/organizationCredentials';

import AppButton from '@renderer/components/ui/AppButton.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();

/* Handlers */
const handleDeleteConnection = async (organizationId: string) => {
  await deleteOrganizationCredentials(organizationId, user.data.id);
  await user.fetchConnectedOrganizations();

  user.data.activeOrganization = null;

  toast.success('Connection deleted successfully');
};
</script>
<template>
  <div>
    <!-- Network -->
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
            <template
              v-for="organization in user.data.connectedOrganizations"
              :key="organization.id"
            >
              <tr>
                <td>
                  <p>
                    {{ organization.nickname }}
                  </p>
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
