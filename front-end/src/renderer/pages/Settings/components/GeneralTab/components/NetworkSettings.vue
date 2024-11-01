<script setup lang="ts">
import type { Network } from '@main/shared/interfaces';
import type { GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

import { inject, onBeforeMount, ref } from 'vue';

import { SELECTED_NETWORK } from '@main/shared/constants';
import { CommonNetwork } from '@main/shared/enums';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';

import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

import { add, getStoredClaim, update } from '@renderer/services/claimService';

import { isUserLoggedIn, withLoader } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();

/* State */
const mirrorNodeInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const isCustomSettingsVisible = ref(false);

const mirrorNodeBaseURL = ref('');

/* Composables */
const toast = useToast();

/* Injected */
const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

/* Handlers */
const handleNetworkChange = async (network: Network) => {
  await updateSelectedNetwork(network);
  await networkStore.setNetwork(network);
};

const handleCommonNetwork = async (network: Network) => {
  isCustomSettingsVisible.value = false;
  await handleNetworkChange(network);
};

const handleMirrorNodeBaseURLChange = async (e: Event) => {
  const value = (e.target as HTMLInputElement)?.value || '';
  if (!value.trim()) {
    forceSetMirrorNodeBaseURL(mirrorNodeBaseURL.value);
    return;
  }

  mirrorNodeBaseURL.value = formatMirrorNodeBaseURL(value);
  forceSetMirrorNodeBaseURL(mirrorNodeBaseURL.value);
  await handleNetworkChange(mirrorNodeBaseURL.value);
};

const updateSelectedNetwork = async (network: Network) => {
  if (!isUserLoggedIn(user.personal)) return;
  const selectedNetwork = await getStoredClaim(user.personal.id, SELECTED_NETWORK);
  const addOrUpdate = selectedNetwork !== undefined ? update : add;
  await addOrUpdate(user.personal.id, SELECTED_NETWORK, network);
};

/* Functions */
const formatMirrorNodeBaseURL = (url: string) => {
  return url
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/:443$/, '')
    .replace(/:443$/, '')
    .replace(/\/$/, '');
};

const forceSetMirrorNodeBaseURL = async (value: string) => {
  if (mirrorNodeInputRef.value?.inputRef) {
    mirrorNodeInputRef.value.inputRef.value = value; // Due to Vue bug
  }
};

/* Hooks */
onBeforeMount(() => {
  if (
    ![
      CommonNetwork.MAINNET,
      CommonNetwork.TESTNET,
      CommonNetwork.PREVIEWNET,
      CommonNetwork.LOCAL_NODE,
    ].includes(networkStore.network)
  ) {
    mirrorNodeBaseURL.value = networkStore.network;
  }
});
</script>
<template>
  <div class="fill-remaining border border-2 rounded-3 p-4">
    <p>Network</p>
    <div class="btn-group rounded-3 overflow-x-auto w-100 pb-2 mt-4">
      <AppButton
        color="secondary"
        data-testid="tab-network-mainnet"
        class="text-nowrap"
        :class="{ active: networkStore.network === CommonNetwork.MAINNET }"
        @click="handleCommonNetwork(CommonNetwork.MAINNET)"
        >Mainnet</AppButton
      >
      <AppButton
        color="secondary"
        data-testid="tab-network-testnet"
        class="text-nowrap"
        :class="{ active: networkStore.network === CommonNetwork.TESTNET }"
        @click="handleCommonNetwork(CommonNetwork.TESTNET)"
        >Testnet</AppButton
      >
      <AppButton
        color="secondary"
        data-testid="tab-network-previewnet"
        class="text-nowrap"
        disabled
        :class="{ active: networkStore.network === CommonNetwork.PREVIEWNET }"
        @click="handleCommonNetwork(CommonNetwork.PREVIEWNET)"
        >Previewnet</AppButton
      >
      <AppButton
        color="secondary"
        data-testid="tab-network-local-node"
        class="text-nowrap"
        :class="{ active: networkStore.network === CommonNetwork.LOCAL_NODE }"
        @click="handleCommonNetwork(CommonNetwork.LOCAL_NODE)"
        >Local Node</AppButton
      >
      <AppButton
        color="secondary"
        data-testid="tab-network-custom"
        class="text-nowrap"
        :class="{
          active: ![
            CommonNetwork.MAINNET,
            CommonNetwork.TESTNET,
            CommonNetwork.PREVIEWNET,
            CommonNetwork.LOCAL_NODE,
          ].includes(networkStore.network as any),
        }"
        @click="isCustomSettingsVisible = !isCustomSettingsVisible"
        >Custom</AppButton
      >
    </div>
    <Transition name="fade" mode="out-in">
      <div v-if="isCustomSettingsVisible" class="mt-4">
        <div class="mt-4">
          <label class="form-label">Mirror Node Base URL</label>
          <AppInput
            ref="mirrorNodeInputRef"
            type="text"
            :filled="true"
            size="small"
            placeholder="Enter Mirror Node Base URL"
            data-testid="input-mirror-node-base-url"
            :model-value="formatMirrorNodeBaseURL(mirrorNodeBaseURL)"
            @change="
              withLoader(
                () => handleMirrorNodeBaseURLChange($event),
                toast,
                globalModalLoaderRef,
                'Failed to update network',
              )()
            "
          />
        </div>
      </div>
    </Transition>
  </div>
</template>
