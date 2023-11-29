<script setup lang="ts">
import axios from 'axios';
import { onMounted, ref, watch } from 'vue';

import { Organization } from '../../main/modules/store';

import Tabs, { TabItem } from '../components/ui/Tabs.vue';
import {
  getMirrorNodeConfig,
  setMirrorNodeLink,
  getOrganizations,
  addOrganization,
  removeOrganization,
} from '../services/configurationService';
import { getStoredKeyPairs, generateKeyPair } from '../services/keyPairService';

/* Props */
const props = defineProps<{ tab: string }>();

/* Tabs */
const tabItems: TabItem[] = [{ title: 'General' }, { title: 'Work Groups' }, { title: 'Keys' }];
const propTabIndex = tabItems.findIndex(
  t => t.title.toLocaleLowerCase().replaceAll(' ', '-') === props.tab,
);
const activeTabIndex = ref(propTabIndex >= 0 ? propTabIndex : 0);
const [general, workGroups, keys] = tabItems.map(t => t.title);

const mainnetMirrorNodeLink = ref('');

/* General */
onMounted(async () => {
  mainnetMirrorNodeLink.value = (await getMirrorNodeConfig()).mainnetLink;
});

watch(mainnetMirrorNodeLink, link => setMirrorNodeLink('mainnetLink', link));

/* Organizations */
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

/* Keys */
const keyPairs = ref<{ privateKey: string; publicKey: string; accountId?: string }[]>([]);

onMounted(async () => {
  keyPairs.value = await getStoredKeyPairs();
});

const index = ref(0);
const handleGenerateKeyPair = async () => {
  try {
    const newKeyPair = await generateKeyPair('', index.value++);
    if (newKeyPair) {
      const mainnetLink = (await getMirrorNodeConfig()).mainnetLink;
      let accountId;

      try {
        const {
          data: { accounts },
        } = await axios.get(`${mainnetLink}/accounts/?account.publickey=${newKeyPair.publicKey}`);
        if (accounts.length > 0) {
          accountId = accounts[0].account;
        }
      } catch (error) {
        console.log('error', error);
      }
      keyPairs.value = [...keyPairs.value, { ...newKeyPair, accountId }];
    }
  } catch (error) {
    console.log(error);
  }
};

// Temporary
const handleClearConfig = () => {
  window.electronAPI.config.clear();
  mainnetMirrorNodeLink.value = '';
  organizations.value = [];
};
</script>
<template>
  <div class="p-10">
    <h1 class="text-huge text-bold">Settings</h1>
    <button class="btn btn-secondary" @click="handleClearConfig">Clear Config</button>
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
        <template #[keys]>
          <div>
            <button class="btn btn-secondary" @click="handleGenerateKeyPair">
              Generate new key pair
            </button>
            <div
              v-for="keyPair in keyPairs"
              :key="keyPair.publicKey"
              class="mt-5 p-4 bg-dark-blue-800"
            >
              <div class="form-group">
                <label class="form-label">Encoded Private key</label>
                <input type="text" readonly class="form-control py-3" :value="keyPair.privateKey" />
              </div>
              <div class="form-group mt-3">
                <label class="form-label">Encoded Public key</label>
                <input type="text" readonly class="form-control py-3" :value="keyPair.publicKey" />
              </div>
              <div v-show="keyPair.accountId" class="form-group mt-3">
                <label class="form-label">Account ID</label>
                <input type="text" readonly class="form-control py-3" :value="keyPair.accountId" />
              </div>
            </div>
          </div>
        </template>
      </Tabs>
    </div>
  </div>
</template>
