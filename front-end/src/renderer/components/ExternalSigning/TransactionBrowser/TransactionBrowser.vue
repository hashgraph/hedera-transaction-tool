<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import useNetworkStore from '@renderer/stores/storeNetwork.ts';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import type { ITransactionBrowserItem } from './ITransactionBrowserItem.ts';
import TransactionBrowserTable from './TransactionBrowserTable.vue';
import { TransactionBrowserEntry } from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserEntry.ts';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';

/* Props */
const props = defineProps<{
  items: ITransactionBrowserItem[];
}>();

/* Injected */
const accountInfoCache = AccountByIdCache.inject();
const nodeInfoCache = NodeByIdCache.inject();

/* Stores */
const network = useNetworkStore();

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
    );
  } catch {
    entries.value = new Error('Failed to create entries');
  }
};

/* Watchers */
watch(() => props.items, updateEntries, { immediate: true });

// /* Handlers */
// const handleNavigate = (targetIndex: number) => {
//   index.value = targetIndex;
// };

onMounted(() => {
  console.log('items=' + JSON.stringify(props.items));
  // console.log('index=' + index.value);
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
