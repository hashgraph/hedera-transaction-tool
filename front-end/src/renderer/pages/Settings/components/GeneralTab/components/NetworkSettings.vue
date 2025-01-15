<script setup lang="ts">
import type { Network } from '@main/shared/interfaces';

import { computed, onBeforeMount, ref } from 'vue';

import { SELECTED_NETWORK } from '@main/shared/constants';
import { CommonNetwork, CommonNetworkNames } from '@main/shared/enums';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import useLoader from '@renderer/composables/useLoader';

import { add, getStoredClaim, update } from '@renderer/services/claimService';

import { isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();

/* Composables */
const withLoader = useLoader();

/* State */
const mirrorNodeInputRef = ref<InstanceType<typeof AppInput> | null>(null);
const isCustomSettingsVisible = ref(false);

const mirrorNodeBaseURL = ref('');

/* Computed */
const isCustomActive = computed(
  () =>
    ![
      CommonNetwork.MAINNET,
      CommonNetwork.TESTNET,
      CommonNetwork.PREVIEWNET,
      CommonNetwork.LOCAL_NODE,
    ].includes(networkStore.network),
);

/* Handlers */
const handleNetworkChange = async (network: Network) => {
  await networkStore.setNetwork(network);
  await updateSelectedNetwork(network);
};

const handleCommonNetwork = async (network: Network) => {
  isCustomSettingsVisible.value = false;
  await handleNetworkChange(network);
};

const handleToggleCustomNetwork = async () => {
  isCustomSettingsVisible.value = !isCustomSettingsVisible.value;

  if (isCustomSettingsVisible.value) {
    await applyCustomNetwork();
  }
};

const handleMirrorNodeBaseURLChange = async () => {
  if (!mirrorNodeInputRef.value?.inputRef) return;

  const value = mirrorNodeInputRef.value.inputRef.value;

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

const applyCustomNetwork = async () => {
  await withLoader(handleMirrorNodeBaseURLChange, 'Failed to update network', 10000, false);
};

/* Hooks */
onBeforeMount(() => {
  if (isCustomActive.value) {
    mirrorNodeBaseURL.value = networkStore.network;
  }
});
</script>
<template>
  <div class="fill-remaining border border-2 rounded-3 p-4">
    <p>Network</p>
    <div class="btn-group-container mt-4" role="group">
      <div class="btn-group gap-3 overflow-x-auto w-100">
        <template v-for="network in CommonNetwork" :key="network">
          <AppButton
            class="rounded-3 text-nowrap"
            :class="{
              active: networkStore.network === network && !isCustomSettingsVisible,
              'text-body': networkStore.network !== network && !isCustomSettingsVisible,
            }"
            :color="
              networkStore.network === network && !isCustomSettingsVisible ? 'primary' : undefined
            "
            @click="handleCommonNetwork(network)"
            :data-testid="`tab-network-${network}`"
            >{{ CommonNetworkNames[network] }}</AppButton
          >
        </template>
        <AppButton
          :color="isCustomActive || isCustomSettingsVisible ? 'primary' : undefined"
          data-testid="tab-network-custom"
          class="rounded-3 text-nowrap"
          :class="{
            active: isCustomActive,
            'text-body': !isCustomActive,
          }"
          @click="handleToggleCustomNetwork"
          >Custom</AppButton
        >
      </div>
    </div>
    <Transition name="fade" mode="out-in">
      <div v-show="isCustomSettingsVisible" class="mt-4">
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
            @blur="applyCustomNetwork"
            @change="applyCustomNetwork"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>
