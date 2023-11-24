<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

import Tabs, { TabItem } from '../components/ui/Tabs.vue';
import {
  getMirrorNodeConfig,
  setMirrorNodeLink,
  getOrganizations,
  addOrganization,
  removeOrganization,
} from '../services/configurationService';
import { Organization } from '../../main/modules/store';

/* Tabs */
const activeTabIndex = ref(0);
const tabItems: TabItem[] = [{ title: 'General' }, { title: 'Work Groups' }, { title: 'Keys' }];
const [general, workGroups, keys] = tabItems.map(t => t.title);

const mainnetMirrorNodeLink = ref('');

/* Organizations */
let organizations = ref<Organization[]>([]);

const newOrganizationName = ref('');
const newOrganizationServerUrl = ref('');

onMounted(async () => {
  try {
    mainnetMirrorNodeLink.value = (await getMirrorNodeConfig()).mainnetLink;
    organizations.value = await getOrganizations();
  } catch (error) {
    console.log(error);
  }
});

watch(mainnetMirrorNodeLink, link => setMirrorNodeLink('mainnetLink', link));

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
</script>
<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">Settings</h1>
    <div class="mt-7">
      <Tabs :items="tabItems" v-model:active-index="activeTabIndex">
        <template #[general]>
          <!-- Local Storage -->
          <div class="p-4 border border-2 rounded-3">
            <p>Local Storage</p>
            <div class="mt-4 d-flex align-items-end">
              <div class="flex-1 me-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >app storage directory</label
                >
                <input type="text" class="form-control py-3" />
              </div>
              <div>
                <button type="button" class="btn btn-primary py-3 px-6">
                  <i class="bi bi-search me-3"></i>Browse
                </button>
              </div>
            </div>
          </div>
          <!-- Mirror Node Settings -->
          <div class="p-4 mt-7 border border-2 rounded-3">
            <p>Mirror Node Settings</p>
            <div class="mt-4">
              <div class="mb-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >Main NET MIRROR NODE LINK</label
                >
                <input type="text" class="form-control py-3" v-model="mainnetMirrorNodeLink" />
              </div>
              <div class="mb-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >TEST NET MIRROR NODE LINK</label
                >
                <input type="text" class="form-control py-3" />
              </div>
              <div class="mb-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >PREVIEW NET MIRROR NODE LINK</label
                >
                <input type="text" class="form-control py-3" />
              </div>
            </div>
          </div>
          <!-- Explorer Settings -->
          <div class="p-4 mt-7 border border-2 rounded-3">
            <p>Explorer Settings</p>
            <div class="mt-4">
              <div class="mb-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >Explorer Link</label
                >
                <input type="text" class="form-control py-3" />
              </div>
              <div class="mb-4">
                <label class="text-secondary-emphasis text-footnote text-uppercase"
                  >Explorer Name</label
                >
                <input type="text" class="form-control py-3" />
              </div>
            </div>
          </div>
        </template>
        <template #[workGroups]>
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
              <button class="btn btn-primary" @click="handleAddOrganization">
                Add Organization
              </button>
            </div>
          </div>
          <div
            v-for="org in organizations"
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
              <button class="btn btn-primary" @click="handleRemoveOrganization(org.serverUrl)">
                Remove
              </button>
            </div>
          </div>
        </template>
        <template #[keys]> Keys tab </template>
      </Tabs>
    </div>
  </div>
</template>
