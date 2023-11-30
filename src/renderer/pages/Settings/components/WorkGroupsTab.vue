<script setup lang="ts">
import { ref, onMounted } from 'vue';

import { Organization } from '../../../../main/modules/store';

import {
  getOrganizations,
  addOrganization,
  removeOrganization,
} from '../../../services/configurationService';

let organizations = ref<Organization[]>([]);

const newOrganizationName = ref('');
const newOrganizationServerUrl = ref('');

onMounted(async () => {
  organizations.value = await getOrganizations();
});

const handleAddOrganization = async () => {
  await addOrganization({
    name: newOrganizationName.value,
    serverUrl: newOrganizationServerUrl.value,
  });
  organizations.value = await getOrganizations();
};

const handleRemoveOrganization = async (serverUrl: string) => {
  await removeOrganization(serverUrl);
  organizations.value = await getOrganizations();
};

// Temporary
const handleClearConfig = () => {
  organizations.value = [];
};
</script>
<template>
  <div class="p-4 border border-2 rounded-3">
    <button class="btn btn-secondary mb-4" @click="handleClearConfig">Clear Config</button>

    <div class="d-flex align-items-center">
      <p class="me-4">Organization name:</p>
      <input type="text" class="form-control w-25 py-3" v-model="newOrganizationName" />
    </div>
    <div class="mt-4 d-flex align-items-end">
      <div class="flex-1 me-4">
        <label class="text-secondary-emphasis text-footnote text-uppercase"
          >organization server url:</label
        >
        <input type="text" class="form-control py-3" v-model="newOrganizationServerUrl" />
      </div>
      <button class="btn btn-primary" @click="handleAddOrganization">Add Organization</button>
    </div>
  </div>
  <div v-for="org in organizations" :key="org.serverUrl" class="p-4 mt-7 border border-2 rounded-3">
    <p>{{ org.name }}</p>
    <div class="mt-4 d-flex align-items-end">
      <div class="flex-1 me-4">
        <label class="text-secondary-emphasis text-footnote text-uppercase"
          >organization server url:</label
        >
        <input type="text" disabled class="form-control py-3" :value="org.serverUrl" />
      </div>
      <button class="btn btn-primary" @click="handleRemoveOrganization(org.serverUrl)">
        Remove
      </button>
    </div>
  </div>
</template>
