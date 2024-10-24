<script setup lang="ts">
import type { Network } from '@main/shared/interfaces';
import type { GLOBAL_MODAL_LOADER_TYPE } from '@renderer/providers';

import { inject, onBeforeMount, ref } from 'vue';
import { Hbar, HbarUnit } from '@hashgraph/sdk';

import { DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY } from '@main/shared/constants';
import { CommonNetwork } from '@main/shared/enums';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';

import { GLOBAL_MODAL_LOADER_KEY } from '@renderer/providers';

import { add, get, update } from '@renderer/services/claimService';

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

const maxTransactionFee = ref<Hbar>(new Hbar(0));

/* Composables */
const toast = useToast();

/* Injected */
const globalModalLoaderRef = inject<GLOBAL_MODAL_LOADER_TYPE>(GLOBAL_MODAL_LOADER_KEY);

/* Handlers */
const handleNetworkChange = async (network: Network) => {
  isCustomSettingsVisible.value = false;
  await networkStore.setNetwork(network);
};

const handleMirrorNodeBaseURLChange = async (e: Event) => {
  const value = (e.target as HTMLInputElement)?.value || '';
  if (!value.trim()) {
    forceSetMirrorNodeBaseURL(mirrorNodeBaseURL.value);
    return;
  }
  mirrorNodeBaseURL.value = formatMirrorNodeBaseURL(value);
  forceSetMirrorNodeBaseURL(mirrorNodeBaseURL.value);
  await networkStore.setNetwork(mirrorNodeBaseURL.value);
};

const handleUpdateMaxTransactionFee = async (newFee: Hbar) => {
  if (!isUserLoggedIn(user.personal)) return;

  const storedClaim = await getStoredClaim(DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY);
  const addOrUpdate = storedClaim !== undefined ? update : add;

  await addOrUpdate(
    user.personal.id,
    DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
    newFee.toString(HbarUnit.Tinybar),
  );

  maxTransactionFee.value = newFee;
};

/* Functions */
const getStoredClaim = async (claimKey: string) => {
  if (!isUserLoggedIn(user.personal)) return;

  const [claim] = await get({
    where: {
      user_id: user.personal.id,
      claim_key: claimKey,
    },
  });

  return claim;
};

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

/** Default Settings */
onBeforeMount(async () => {
  const storeMaxTransactionFee = await getStoredClaim(DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY);

  if (storeMaxTransactionFee !== undefined) {
    maxTransactionFee.value = Hbar.fromString(storeMaxTransactionFee.claim_value, HbarUnit.Tinybar);
  } else {
    maxTransactionFee.value = new Hbar(2);
    await handleUpdateMaxTransactionFee(new Hbar(2));
  }
});
</script>
<template>
  <div class="fill-remaining overflow-x-auto border border-2 rounded-3 p-4">
    <p>Network</p>
    <div class="w-100 btn-group mt-4">
      <AppButton
        color="secondary"
        data-testid="tab-network-mainnet"
        class="text-nowrap"
        :class="{ active: networkStore.network === CommonNetwork.MAINNET }"
        @click="handleNetworkChange(CommonNetwork.MAINNET)"
        >Mainnet</AppButton
      >
      <AppButton
        color="secondary"
        data-testid="tab-network-testnet"
        class="text-nowrap"
        :class="{ active: networkStore.network === CommonNetwork.TESTNET }"
        @click="handleNetworkChange(CommonNetwork.TESTNET)"
        >Testnet</AppButton
      >
      <AppButton
        color="secondary"
        data-testid="tab-network-previewnet"
        class="text-nowrap"
        disabled
        :class="{ active: networkStore.network === CommonNetwork.PREVIEWNET }"
        @click="handleNetworkChange(CommonNetwork.PREVIEWNET)"
        >Previewnet</AppButton
      >
      <AppButton
        color="secondary"
        data-testid="tab-network-local-node"
        class="text-nowrap"
        :class="{ active: networkStore.network === CommonNetwork.LOCAL_NODE }"
        @click="handleNetworkChange(CommonNetwork.LOCAL_NODE)"
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
