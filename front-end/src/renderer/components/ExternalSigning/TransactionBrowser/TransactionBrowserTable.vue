<script setup lang="ts">
import { computed, ref } from 'vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import type { ITransactionBrowserItem } from './ITransactionBrowserItem';
import TransactionBrowserRow from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserRow.vue';
import TransactionBrowserPage from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserPage.vue';

/* Props */
const props = defineProps<{
  items: ITransactionBrowserItem[];
}>();

/* State */
const currentPage = ref(1);
const pageSize = ref(15);
const showDetailsModal = ref(false);
const detailedItemIndex = ref(-1);

/* Computed */
const pageStart = computed(() => (currentPage.value - 1) * pageSize.value);
const pagedItems = computed(() => {
  return props.items.slice(pageStart.value, pageStart.value + pageSize.value);
});

/* Handlers */
const handleDetails = (index: number) => {
  detailedItemIndex.value = pageStart.value + index;
  showDetailsModal.value = true;
};
</script>

<template>
  <table class="table-custom">
    <thead>
      <tr>
        <th>Transaction ID</th>
        <th>Transaction Type</th>
        <th>Description</th>
        <th>Valid Start</th>
        <th>Creator email</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="(item, index) of pagedItems" :key="pageStart + index">
        <TransactionBrowserRow :index="pageStart + index" :item="item" @details="handleDetails" />
      </template>
    </tbody>
    <tfoot v-if="items.length > pageSize" class="d-table-caption">
      <tr class="d-inline">
        <AppPager
          v-model:current-page="currentPage"
          v-model:per-page="pageSize"
          :total-items="items.length"
        />
      </tr>
    </tfoot>
  </table>

  <TransactionBrowserPage
    v-if="showDetailsModal && detailedItemIndex !== -1"
    v-model:current-index="detailedItemIndex"
    v-model:show="showDetailsModal"
    :items="items"
    @next="detailedItemIndex += 1"
    @previous="detailedItemIndex -= 1"
  />
</template>
