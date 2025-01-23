<script setup lang="ts">
import type { Network } from '@main/shared/interfaces';

import { computed, onBeforeMount, ref } from 'vue';

import { SELECTED_NETWORK } from '@main/shared/constants';
import { CommonNetwork, CommonNetworkNames } from '@main/shared/enums';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import useLoader from '@renderer/composables/useLoader';

import { add, getStoredClaim, update } from '@renderer/services/claimService';

import { isUserLoggedIn, normalizeNetworkName } from '@renderer/utils';

import AppInput from '@renderer/components/ui/AppInput.vue';
import ButtonGroup from '@renderer/components/ui/ButtonGroup.vue';
import useNotificationsStore from '@renderer/stores/storeNotifications';

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();
const notificationsStore = useNotificationsStore();

/* Composables */
const withLoader = useLoader();

/* Computed */
const networkNotifications = computed(() => {
  const network = normalizeNetworkName(networkStore.network);
  return Object.entries(notificationsStore.networkNotifications).reduce(
    (acc, [key, value]) => {
      if (value && key !== network) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, unknown>,
  );
});

console.log(networkNotifications.value);

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

const networkButtons = computed(() => [
  ...Object.values(CommonNetwork).map(network => ({
    label: CommonNetworkNames[network],
    value: network,
    id: `tab-network-${network}`,
  })),
  { label: 'Custom', value: 'custom', id: `tab-network-custom` },
]);

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

const handleChange = (network: Network) => {
  if (network === 'custom') {
    handleToggleCustomNetwork();
  } else {
    handleCommonNetwork(network);
  }
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
    <div class="mt-4">
      <ButtonGroup
        :items="networkButtons"
        :activeValue="isCustomSettingsVisible ? 'custom' : networkStore.network"
        color="primary"
        @change="
          value => {
            handleChange(value as string);
          }
        "
      />
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
