<script setup lang="ts">
import { ref } from 'vue';

import useOrganizationsStore from '../../../stores/storeOrganizations';

import { useToast } from 'vue-toast-notification';

import AppButton from '../../../components/ui/AppButton.vue';

/* Stores */
const organizationsStore = useOrganizationsStore();

/* Composables */
const toast = useToast();

/* State */
const newOrganizationName = ref('');
const newOrganizationServerUrl = ref('');
const newOrganizationServerPublicKey = ref('');

/* Handlers */
const handleAddOrganization = async () => {
  if (newOrganizationName.value !== '' && newOrganizationServerUrl.value !== '') {
    try {
      await organizationsStore.addOrganization({
        name: newOrganizationName.value,
        serverUrl: newOrganizationServerUrl.value,
        serverPublicKey: newOrganizationServerPublicKey.value,
      });

      toast.success('Organization added successfully', { position: 'top-right' });
    } catch (err: any) {
      let message = 'Failed to add organization';
      if (err.message && typeof err.message === 'string') {
        message = err.message;
      }
      toast.error(message, { position: 'top-right' });
    }
  }
};

const handleRemoveOrganization = async (serverUrl: string) => {
  try {
    await organizationsStore.removeOrganization(serverUrl);

    toast.success('Organization removed successfully', { position: 'top-right' });
  } catch (err: any) {
    let message = 'Failed to remove organization';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'top-right' });
  }
};
</script>
<template>
  <div class="p-4 border border-2 rounded-3">
    <div class="d-flex align-items-center">
      <p class="me-4">Organization name:</p>
      <input type="text" class="form-control w-25 py-3" v-model="newOrganizationName" />
    </div>
    <div class="mt-4">
      <label class="form-label">organization server public key:</label>
      <input type="text" class="form-control py-3" v-model="newOrganizationServerPublicKey" />
    </div>
    <div class="mt-4 d-flex align-items-end">
      <div class="flex-1 me-4">
        <label class="form-label">organization server url:</label>
        <input type="text" class="form-control py-3" v-model="newOrganizationServerUrl" />
      </div>
      <AppButton color="primary" @click="handleAddOrganization">Add Organization</AppButton>
    </div>
  </div>
  <div
    v-for="org in organizationsStore.organizations"
    :key="org.serverUrl"
    class="p-4 mt-7 border border-2 rounded-3"
  >
    <p>{{ org.name }}</p>
    <div class="mt-4 d-flex align-items-end">
      <div class="flex-1 me-4">
        <label class="form-label">organization server url:</label>
        <input type="text" disabled class="form-control py-3" :value="org.serverUrl" />
      </div>
      <AppButton color="primary" @click="handleRemoveOrganization(org.serverUrl)">
        Remove
      </AppButton>
    </div>
  </div>
</template>
