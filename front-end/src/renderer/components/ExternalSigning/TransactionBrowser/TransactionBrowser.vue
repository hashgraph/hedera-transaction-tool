<script setup lang="ts">
import { onMounted } from 'vue';
import TransactionBrowserTable from './TransactionBrowserTable.vue';
import type { ITransactionBrowserItem } from './ITransactionBrowserItem.ts';

/* Props */
const props = defineProps<{
  items: ITransactionBrowserItem[];
}>();

// /* State */
// const index = ref(0);
//
// /* Watchers */
// watch(
//   () => props.items,
//   () => {
//     index.value = 0;
//   },
//   { immediate: true },
// );
//
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
  <template v-if="props.items.length >= 1">
    <TransactionBrowserTable :items="props.items" />
  </template>
  <!--
  <template v-if="props.items.length === 1">
    <TransactionBrowserPage :item="props.items[0]" />
  </template>
-->
  <template v-else>
    <span>No transactions to browse</span>
  </template>
</template>
