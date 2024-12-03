<script setup lang="ts">
import type { Organization } from '@prisma/client';

import { onBeforeMount, ref } from 'vue';

import { useToast } from 'vue-toast-notification';

import { getOrganizations, addOrganization } from '@renderer/services/organizationsService';

import { getErrorMessage } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Composables */
const toast = useToast();

/* State */
const newOrganizationName = ref('');
const newOrganizationServerUrl = ref('');
const newOrganizationServerPublicKey = ref('');
const organizations = ref<Organization[]>();

/* Handlers */
const handleAddOrganization = async (e: Event) => {
  e.preventDefault();

  if (newOrganizationName.value !== '' && newOrganizationServerUrl.value !== '') {
    try {
      await addOrganization({
        nickname: newOrganizationName.value,
        serverUrl: newOrganizationServerUrl.value,
        key: newOrganizationServerPublicKey.value,
      });

      toast.success('Organization added successfully');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to add organization'));
    }
  }
};

/* Hooks */
onBeforeMount(async () => {
  organizations.value = await getOrganizations();
});
</script>
<template>
  <div class="flex-column-100">
    <form class="p-4 border border-2 rounded-3" @submit="handleAddOrganization">
      <div class="d-flex align-items-center">
        <p class="me-4">Organization name:</p>
        <AppInput :filled="true" class="w-25 py-3" v-model="newOrganizationName" />
      </div>
      <div class="mt-4">
        <label class="form-label">organization server public key:</label>
        <AppInput :filled="true" class="py-3" v-model="newOrganizationServerPublicKey" />
      </div>
      <div class="mt-4 d-flex align-items-end">
        <div class="flex-1 me-4">
          <label class="form-label">organization server url:</label>
          <AppInput :filled="true" class="py-3" v-model="newOrganizationServerUrl" />
        </div>
        <AppButton color="primary" type="submit">Add Organization</AppButton>
      </div>
    </form>
    <div v-for="org in organizations" :key="org.id" class="p-4 mt-7 border border-2 rounded-3">
      <p>{{ org.nickname }}</p>
      <div class="mt-4 d-flex align-items-end">
        <div class="flex-1 me-4">
          <label class="form-label">organization server url:</label>
          <AppInput :filled="true" disabled class="py-3" :value="org.serverUrl" />
        </div>
        <!-- <AppButton color="primary" @click="handleRemoveOrganization(org.id)"> Remove </AppButton> -->
      </div>
    </div>
  </div>
</template>
