<script setup lang="ts">
import { ref } from 'vue';

import useOrganizationsStore from '../../../stores/storeOrganizations';

const organizationsStore = useOrganizationsStore();

const newOrganizationName = ref('');
const newOrganizationServerUrl = ref('');

const handleAddOrganization = async () => {
  if (newOrganizationName.value !== '' && newOrganizationServerUrl.value !== '') {
    organizationsStore.addOrganization({
      name: newOrganizationName.value,
      serverUrl: newOrganizationServerUrl.value,
    });
  }
};
</script>
<template>
  <div class="p-4 border border-2 rounded-3">
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
  <div
    v-for="org in organizationsStore.organizations"
    :key="org.serverUrl"
    class="p-4 mt-7 border border-2 rounded-3"
  >
    <p>{{ org.name }}</p>
    <div class="mt-4 d-flex align-items-end">
      <div class="flex-1 me-4">
        <label class="text-secondary-emphasis text-footnote text-uppercase"
          >organization server url:</label
        >
        <input type="text" disabled class="form-control py-3" :value="org.serverUrl" />
      </div>
      <button class="btn btn-primary" @click="organizationsStore.removeOrganization(org.serverUrl)">
        Remove
      </button>
    </div>
  </div>
</template>
