<script setup lang="ts">
import { computed } from 'vue';
import useNetworkStore from '@renderer/stores/storeNetwork.ts';
import AppSelect from '@renderer/components/ui/AppSelect.vue';
import type { Network } from '@shared/interfaces';
import { CommonNetwork } from '@shared/enums';

/* Stores */
const networkStore = useNetworkStore();

/* Computed */
const networkButtons = computed((): { label: string; value: Network }[] => {
  const result: { label: string; value: Network }[] = [];
  for (const network of networkStore.allNetworks) {
    result.push({
      label: networkStore.getNetworkLabel(network).toUpperCase(),
      value: network,
    });
  }
  return result;
});

/* Handlers */
const handleNetworkSelect = async (newValue: Network | undefined) => {
  await networkStore.setNetwork(newValue ?? CommonNetwork.MAINNET);
};
</script>

<template>
  <AppSelect
    :value="networkStore.network"
    :items="networkButtons"
    @update:value="handleNetworkSelect"
    toggle-text="Select Network"
    toggler-icon
    :color="'secondary'"
    button-class="min-w-100"
  />
</template>
