<script setup lang="ts">
import type { Theme } from '@main/shared/interfaces';

import { onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { Hbar, HbarUnit } from '@hashgraph/sdk';

import { DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY } from '@main/shared/constants';

import useUserStore from '@renderer/stores/storeUser';

import { add, get, update } from '@renderer/services/claimService';

import { isUserLoggedIn } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppHbarInput from '@renderer/components/ui/AppHbarInput.vue';
import NetworkSettings from './components/NetworkSettings.vue';

/* Stores */
const user = useUserStore();

/* State */
const theme = ref<Theme>('light');
const onUpdateUnsubscribe = ref<() => void>();

const maxTransactionFee = ref<Hbar>(new Hbar(0));

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
    <NetworkSettings />

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
