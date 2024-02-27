<script setup lang="ts">
import {onMounted, ref} from 'vue';

import {useToast} from 'vue-toast-notification';

import useNetworkStore from '@renderer/stores/storeNetwork';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import {isAccountId} from '@renderer/utils/validator';

/* Stores */
const networkStore = useNetworkStore();

/* Composables */
const toast = useToast();

/* State */
const isCustomSettingsVisible = ref(false);

const consensusNodeEndpoint = ref('127.0.0.1:50211');
const mirrorNodeGRPCEndpoint = ref('127.0.0.1:5600');
const mirrorNodeRESTAPIEndpoint = ref('http://localhost:5551/api/v1');
const nodeAccountId = ref('0.0.3');

/* Handlers */
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
    toast.error(message, {position: 'bottom-right'});
  }
};

/* Hooks */
onMounted(() => {
  if (networkStore.customNetworkSettings) {
    const firstNodeAccountId = Object.entries(networkStore.customNetworkSettings.nodeAccountIds)[0];

    consensusNodeEndpoint.value = firstNodeAccountId[0];
    nodeAccountId.value = firstNodeAccountId[1];
    mirrorNodeGRPCEndpoint.value = networkStore.customNetworkSettings.mirrorNodeGRPCEndpoint;
    mirrorNodeRESTAPIEndpoint.value = networkStore.customNetworkSettings.mirrorNodeRESTAPIEndpoint;
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
          :class="{active: networkStore.network === 'mainnet'}"
          @click="
            networkStore.setNetwork('mainnet');
            isCustomSettingsVisible = false;
          "
          >Mainnet</AppButton
        >
        <AppButton
          color="primary"
          :class="{active: networkStore.network === 'testnet'}"
          @click="
            networkStore.setNetwork('testnet');
            isCustomSettingsVisible = false;
          "
          >Testnet</AppButton
        >
        <AppButton
          color="primary"
          disabled
          :class="{active: networkStore.network === 'previewnet'}"
          @click="
            networkStore.setNetwork('previewnet');
            isCustomSettingsVisible = false;
          "
          >Previewnet</AppButton
        >
        <AppButton
          color="primary"
          :class="{active: networkStore.network === 'custom'}"
          @click="isCustomSettingsVisible = true"
          >Custom</AppButton
        >
      </div>
      <Transition
        name="fade"
        mode="out-in"
      >
        <div
          v-if="isCustomSettingsVisible"
          class="mt-4"
        >
          <div>
            <label class="form-label">Consensus Node Endpoint</label>
            <AppInput
              type="text"
              :filled="true"
              size="small"
              v-model="consensusNodeEndpoint"
            />
          </div>
          <div class="mt-4">
            <label class="form-label">Mirror Node GRPC Endpoint</label>
            <AppInput
              type="text"
              :filled="true"
              size="small"
              v-model="mirrorNodeGRPCEndpoint"
            />
          </div>
          <div class="mt-4">
            <label class="form-label">Mirror Node REST API Endpoint</label>
            <AppInput
              type="text"
              :filled="true"
              size="small"
              v-model="mirrorNodeRESTAPIEndpoint"
            />
          </div>
          <div class="mt-4">
            <label class="form-label">Node Account Id</label>
            <AppInput
              type="text"
              :filled="true"
              size="small"
              v-model="nodeAccountId"
            />
          </div>
          <AppButton
            color="primary"
            class="mt-4"
            @click="handleSetCustomNetwork"
            >Set</AppButton
          >
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
  </div>
</template>
