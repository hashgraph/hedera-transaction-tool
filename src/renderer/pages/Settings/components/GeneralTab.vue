<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { AccountId } from '@hashgraph/sdk';

import useNetworkStore, { CustomNetworkSettings } from '../../../stores/storeNetwork';

import AppButton from '../../../components/ui/AppButton.vue';

const networkStore = useNetworkStore();

const isCustomSettingsVisible = ref(false);

const customNetworkSettings = ref<CustomNetworkSettings>({
  consensusNodeEndpoint: 'http://localhost:50211',
  mirrorNodeGRPCEndpoint: 'http://localhost:5600',
  mirrorNodeRESTAPIEndpoint: 'http://localhost:5551/api/v1',
  nodeAccountId: new AccountId(3),
});

const handleSetCustomNetwork = async () => {
  customNetworkSettings.value.nodeAccountId = customNetworkSettings.value.nodeAccountId.toString();

  await networkStore.setNetwork('custom', customNetworkSettings.value as any);
};

onMounted(() => {
  if (networkStore.customNetworkSettings) {
    customNetworkSettings.value = networkStore.customNetworkSettings;
  }
});
</script>
<template>
  <div>
    <!-- Network -->
    <div class="p-4 border border-2 rounded-3">
      <p>Network</p>
      <div class="mt-4 btn-group">
        <AppButton
          color="primary"
          disabled
          :class="{ active: networkStore.network === 'mainnet' }"
          @click="
            networkStore.setNetwork('mainnet');
            isCustomSettingsVisible = false;
          "
          >Mainnet</AppButton
        >
        <AppButton
          color="primary"
          :class="{ active: networkStore.network === 'testnet' }"
          @click="
            networkStore.setNetwork('testnet');
            isCustomSettingsVisible = false;
          "
          >Testnet</AppButton
        >
        <AppButton
          color="primary"
          disabled
          :class="{ active: networkStore.network === 'previewnet' }"
          @click="
            networkStore.setNetwork('previewnet');
            isCustomSettingsVisible = false;
          "
          >Previewnet</AppButton
        >
        <AppButton
          color="primary"
          :class="{ active: networkStore.network === 'custom' }"
          @click="isCustomSettingsVisible = true"
          >Custom</AppButton
        >
      </div>
      <Transition name="fade" mode="out-in">
        <div v-if="isCustomSettingsVisible" class="mt-4">
          <div>
            <label class="form-label">Consensus Node Endpoint</label>
            <input
              type="text"
              class="form-control form-control-sm"
              v-model="customNetworkSettings.consensusNodeEndpoint"
            />
          </div>
          <div class="mt-4">
            <label class="form-label">Mirror Node GRPC Endpoint</label>
            <input
              type="text"
              class="form-control form-control-sm"
              v-model="customNetworkSettings.mirrorNodeGRPCEndpoint"
            />
          </div>
          <div class="mt-4">
            <label class="form-label">Mirror Node REST API Endpoint</label>
            <input
              type="text"
              class="form-control form-control-sm"
              v-model="customNetworkSettings.mirrorNodeRESTAPIEndpoint"
            />
          </div>
          <div class="mt-4">
            <label class="form-label">Node Account Id</label>
            <input
              type="text"
              class="form-control form-control-sm"
              v-model="customNetworkSettings.nodeAccountId"
            />
          </div>
          <AppButton color="primary" class="mt-4" @click="handleSetCustomNetwork">Set</AppButton>
        </div>
      </Transition>
    </div>
    <!-- Mirror Node Settings -->
    <div class="p-4 mt-7 border border-2 rounded-3">
      <p>Mirror Node Settings</p>
      <div class="mt-4">
        <div class="mb-4">
          <label class="form-label">Main NET MIRROR NODE LINK</label>
          <input
            type="text"
            class="form-control py-3"
            :value="networkStore.getMirrorNodeLinkByNetwork('mainnet')"
            readonly
          />
        </div>
        <div class="mb-4">
          <label class="form-label">TEST NET MIRROR NODE LINK</label>
          <input
            type="text"
            class="form-control py-3"
            :value="networkStore.getMirrorNodeLinkByNetwork('testnet')"
            readonly
          />
        </div>
        <div class="mb-4">
          <label class="form-label">PREVIEW NET MIRROR NODE LINK</label>
          <input
            type="text"
            class="form-control py-3"
            :value="networkStore.getMirrorNodeLinkByNetwork('previewnet')"
            readonly
          />
        </div>
      </div>
    </div>
    <!-- Explorer Settings -->
    <div class="p-4 mt-7 border border-2 rounded-3">
      <p>Explorer Settings</p>
      <div class="mt-4">
        <div class="mb-4">
          <label class="form-label">Explorer Link</label>
          <input type="text" class="form-control py-3" />
        </div>
        <div class="mb-4">
          <label class="form-label">Explorer Name</label>
          <input type="text" class="form-control py-3" />
        </div>
      </div>
    </div>
  </div>
</template>
