<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';

import { Theme } from '@main/shared/interfaces';

import useNetworkStore, { Network } from '@renderer/stores/storeNetwork';
import useKeyPairsStore from '@renderer/stores/storeKeyPairs';

import { useToast } from 'vue-toast-notification';

import { isAccountId } from '@renderer/utils/validator';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Stores */
const networkStore = useNetworkStore();
const keyPairsStore = useKeyPairsStore();

/* Composables */
const toast = useToast();

/* State */
const isCustomSettingsVisible = ref(false);

const consensusNodeEndpoint = ref('127.0.0.1:50211');
const mirrorNodeGRPCEndpoint = ref('127.0.0.1:5600');
const mirrorNodeRESTAPIEndpoint = ref('http://localhost:5551/api/v1');
const nodeAccountId = ref('0.0.3');

const theme = ref<Theme>('light');

/* Handlers */
const handleNetworkChange = async (network: Network) => {
  networkStore.setNetwork(network);
  if (network !== 'custom') {
    isCustomSettingsVisible.value = false;
  }

  await keyPairsStore.refetch();
};

const handleSetCustomNetwork = async () => {
  try {
    if (!isAccountId(nodeAccountId.value)) {
      throw new Error('Invalid node account ID');
    }

    await networkStore.setNetwork('custom', {
      nodeAccountIds: {
        [consensusNodeEndpoint.value]: nodeAccountId.value,
      },
      mirrorNodeGRPCEndpoint: mirrorNodeGRPCEndpoint.value,
      mirrorNodeRESTAPIEndpoint: mirrorNodeRESTAPIEndpoint.value,
    });
  } catch (err: any) {
    let message = 'Failed to set custom network';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'bottom-right' });
  }

  await keyPairsStore.refetch();
};

const handleThemeChange = (newTheme: Theme) => {
  window.electronAPI.theme.toggle(newTheme);
};

/* Hooks */
onBeforeMount(async () => {
  if (networkStore.customNetworkSettings) {
    const firstNodeAccountId = Object.entries(networkStore.customNetworkSettings.nodeAccountIds)[0];

    consensusNodeEndpoint.value = firstNodeAccountId[0];
    nodeAccountId.value = firstNodeAccountId[1];
    mirrorNodeGRPCEndpoint.value = networkStore.customNetworkSettings.mirrorNodeGRPCEndpoint;
    mirrorNodeRESTAPIEndpoint.value = networkStore.customNetworkSettings.mirrorNodeRESTAPIEndpoint;
  }

  window.electronAPI.theme.onThemeUpdate(newTheme => {
    document.body.setAttribute('data-bs-theme', newTheme.shouldUseDarkColors ? 'dark' : 'light');
    theme.value = newTheme.themeSource;
  });

  theme.value = await window.electronAPI.theme.mode();
});
</script>
<template>
  <div>
    <!-- Network -->
    <div class="fill-remaining border border-2 rounded-3 p-4">
      <p>Network</p>
      <div class="mt-4 btn-group">
        <AppButton
          color="secondary"
          :class="{ active: networkStore.network === 'mainnet' }"
          @click="handleNetworkChange('mainnet')"
          >Mainnet</AppButton
        >
        <AppButton
          color="secondary"
          :class="{ active: networkStore.network === 'testnet' }"
          @click="handleNetworkChange('testnet')"
          >Testnet</AppButton
        >
        <AppButton
          color="secondary"
          disabled
          :class="{ active: networkStore.network === 'previewnet' }"
          @click="handleNetworkChange('previewnet')"
          >Previewnet</AppButton
        >
        <AppButton
          color="secondary"
          :class="{ active: networkStore.network === 'custom' }"
          @click="isCustomSettingsVisible = true"
          >Custom</AppButton
        >
      </div>
      <Transition name="fade" mode="out-in">
        <div v-if="isCustomSettingsVisible" class="mt-4">
          <div>
            <label class="form-label">Consensus Node Endpoint</label>
            <AppInput type="text" :filled="true" size="small" v-model="consensusNodeEndpoint" />
          </div>
          <div class="mt-4">
            <label class="form-label">Mirror Node GRPC Endpoint</label>
            <AppInput type="text" :filled="true" size="small" v-model="mirrorNodeGRPCEndpoint" />
          </div>
          <div class="mt-4">
            <label class="form-label">Mirror Node REST API Endpoint</label>
            <AppInput type="text" :filled="true" size="small" v-model="mirrorNodeRESTAPIEndpoint" />
          </div>
          <div class="mt-4">
            <label class="form-label">Node Account Id</label>
            <AppInput type="text" :filled="true" size="small" v-model="nodeAccountId" />
          </div>
          <AppButton color="primary" class="mt-4" @click="handleSetCustomNetwork">Set</AppButton>
        </div>
      </Transition>
    </div>
    <!-- Mirror Node Settings -->
    <!-- <div class="p-4 mt-7 border border-2 rounded-3">
      <p>Mirror Node Settings</p>
      <div class="mt-4">
        <div class="mb-4">
          <label class="form-label">Main NET MIRROR NODE LINK</label>
          <AppInput
            type="text"
            class="py-3"
            :filled="true"
            :model-value="networkStore.getMirrorNodeLinkByNetwork('mainnet')"
            readonly
          />
        </div>
        <div class="mb-4">
          <label class="form-label">TEST NET MIRROR NODE LINK</label>
          <AppInput
            type="text"
            class="py-3"
            :filled="true"
            :model-value="networkStore.getMirrorNodeLinkByNetwork('testnet')"
            readonly
          />
        </div>
        <div class="mb-4">
          <label class="form-label">PREVIEW NET MIRROR NODE LINK</label>
          <AppInput
            type="text"
            class="py-3"
            :filled="true"
            :model-value="networkStore.getMirrorNodeLinkByNetwork('previewnet')"
            readonly
          />
        </div>
      </div>
    </div> -->
    <!-- Explorer Settings -->
    <!-- <div class="p-4 mt-7 border border-2 rounded-3">
      <p>Explorer Settings</p>
      <div class="mt-4">
        <div class="mb-4">
          <label class="form-label">Explorer Link</label>
          <AppInput type="text" :filled="true" class="py-3" />
        </div>
        <div class="mb-4">
          <label class="form-label">Explorer Name</label>
          <AppInput type="text" :filled="true" class="py-3" />
        </div>
      </div>
    </div> -->

    <!-- Appearance -->
    <div class="p-4 border border-2 rounded-3 mt-5">
      <p>Appearance</p>
      <div class="mt-4 btn-group">
        <AppButton
          :color="'secondary'"
          :class="{ active: theme === 'dark' }"
          @click="handleThemeChange('dark')"
          >Dark</AppButton
        >
        <AppButton
          :color="'secondary'"
          :class="{ active: theme === 'light' }"
          @click="handleThemeChange('light')"
          >Light</AppButton
        >
        <AppButton
          :color="'secondary'"
          :class="{ active: theme === 'system' }"
          @click="handleThemeChange('system')"
          >System</AppButton
        >
      </div>
    </div>
  </div>
</template>
