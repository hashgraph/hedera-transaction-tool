<script setup lang="ts">
import type { Network, Theme } from '@main/shared/interfaces';

import { onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { Hbar, HbarUnit } from '@hashgraph/sdk';

import { DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY } from '@main/shared/constants';
import { CommonNetwork } from '@main/shared/enums';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { add, get, update } from '@renderer/services/claimService';

import { isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';

/* Stores */
const user = useUserStore();
const networkStore = useNetworkStore();

/* State */
const isCustomSettingsVisible = ref(false);

const mirrorNodeGRPCEndpoint = ref('127.0.0.1:5600');
const mirrorNodeRESTAPIEndpoint = ref('http://localhost:5551/api/v1');

const theme = ref<Theme>('light');
const onUpdateUnsubscribe = ref<() => void>();

const maxTransactionFee = ref<Hbar>(new Hbar(0));

/* Handlers */
const handleNetworkChange = async (network: Network) => {
  isCustomSettingsVisible.value = false;
  await networkStore.setNetwork(network);
};

const handleSetCustomNetwork = async () => {
  await networkStore.setNetwork(mirrorNodeGRPCEndpoint.value, mirrorNodeRESTAPIEndpoint.value);
};

const handleThemeChange = (newTheme: Theme) => {
  window.electronAPI.local.theme.toggle(newTheme);
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

/* Hooks */
/** Network */
onBeforeMount(() => {
  if (
    ![
      CommonNetwork.MAINNET,
      CommonNetwork.TESTNET,
      CommonNetwork.PREVIEWNET,
      CommonNetwork.LOCAL_NODE,
    ].includes(networkStore.network)
  ) {
    mirrorNodeGRPCEndpoint.value = networkStore.network;
    mirrorNodeRESTAPIEndpoint.value = networkStore.mirrorNodeBaseURL;
  }
});

/** Theme */
onBeforeMount(async () => {
  onUpdateUnsubscribe.value = window.electronAPI.local.theme.onThemeUpdate(
    (newTheme: { themeSource: Theme; shouldUseDarkColors: boolean }) => {
      document.body.setAttribute('data-bs-theme', newTheme.shouldUseDarkColors ? 'dark' : 'light');
      theme.value = newTheme.themeSource;
    },
  );
  theme.value = await window.electronAPI.local.theme.mode();
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

onBeforeUnmount(() => {
  if (onUpdateUnsubscribe.value) {
    onUpdateUnsubscribe.value();
  }
});
</script>
<template>
  <div>
    <!-- Network -->
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
          data-testid="tab-network-custom"
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
            <label class="form-label">Mirror Node GRPC Endpoint</label>
            <AppInput
              type="text"
              :filled="true"
              size="small"
              data-testid="input-mirror-grpc-endpoint"
              v-model="mirrorNodeGRPCEndpoint"
            />
          </div>
          <div class="mt-4">
            <label class="form-label">Mirror Node REST API Endpoint</label>
            <AppInput
              type="text"
              :filled="true"
              size="small"
              data-testid="input-mirror-rest-endpoint"
              v-model="mirrorNodeRESTAPIEndpoint"
            />
          </div>
          <AppButton
            color="primary"
            class="mt-4"
            data-testid="button-set"
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

    <!-- Appearance -->
    <div class="p-4 border border-2 rounded-3 mt-5">
      <p>Appearance</p>
      <div class="mt-4 btn-group">
        <AppButton
          :color="'secondary'"
          data-testid="tab-appearance-dark"
          :class="{ active: theme === 'dark' }"
          @click="handleThemeChange('dark')"
          >Dark</AppButton
        >
        <AppButton
          :color="'secondary'"
          data-testid="tab-appearance-light"
          :class="{ active: theme === 'light' }"
          @click="handleThemeChange('light')"
          >Light</AppButton
        >
        <AppButton
          :color="'secondary'"
          data-testid="tab-appearance-system"
          :class="{ active: theme === 'system' }"
          @click="handleThemeChange('system')"
          >System</AppButton
        >
      </div>
    </div>

    <!-- Default Settings -->
    <div class="p-4 border border-2 rounded-3 mt-5">
      <p>Default Settings</p>
      <div class="mt-4">
        <div class="col-sm-5 col-lg-4">
          <label class="form-label me-3">Max Transaction Fee {{ HbarUnit.Hbar._symbol }}</label>
          <AppHbarInput
            :model-value="maxTransactionFee as Hbar"
            @update:model-value="handleUpdateMaxTransactionFee"
            placeholder="Enter Amount in Hbar"
            :filled="true"
            data-testid="input-default-max-transaction-fee"
          />
        </div>
      </div>
    </div>
  </div>
</template>
