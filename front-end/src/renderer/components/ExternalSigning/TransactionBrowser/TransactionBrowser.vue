<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import useNetworkStore from '@renderer/stores/storeNetwork.ts';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import type { ITransactionBrowserItem } from './ITransactionBrowserItem.ts';
import TransactionBrowserTable from './TransactionBrowserTable.vue';
import { TransactionBrowserEntry } from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserEntry.ts';
import { AppCache } from '@renderer/caches/AppCache.ts';
import useUserStore from '@renderer/stores/storeUser.ts';

/* Props */
const props = defineProps<{
  items: ITransactionBrowserItem[];
}>();

/* Injected */
const appCache = AppCache.inject();
const accountInfoCache = appCache.mirrorAccountById;
const nodeInfoCache = appCache.mirrorNodeById;
const publicKeyOwnerCache = appCache.backendPublicKeyOwner;

/* Stores */
const network = useNetworkStore();
const user = useUserStore();

/* State */
const entries = ref<TransactionBrowserEntry[] | Error | null>(null); // null means loading

/* Handlers */
const updateEntries = async () => {
  entries.value = null;
  try {
    const mirrorNodeLink = network.getMirrorNodeREST(network.network);
    entries.value = await TransactionBrowserEntry.makeFromArray(
      props.items,
      mirrorNodeLink,
      accountInfoCache,
      nodeInfoCache,
      publicKeyOwnerCache,
      user.publicKeys,
    );
  } catch {
    entries.value = new Error('Failed to create entries');
  }
};

/* Watchers */
watch(() => props.items, updateEntries, { immediate: true });

onMounted(() => {
  // items and index logged via framework
});
</script>

<template>
  <AppLoader v-if="entries === null" />
  <template v-else-if="entries instanceof Error">
    <span>Loading failure</span>
  </template>
  <template v-else-if="entries.length >= 1">
    <TransactionBrowserTable :entries="entries as TransactionBrowserEntry[]" />
  </template>
  <template v-else>
    <span>No transactions to browse</span>
  </template>
</template>
