<script setup lang="ts">
import { computed, ref } from 'vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import type { TransactionBrowserEntry } from './TransactionBrowserEntry';
import TransactionBrowserRow from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserRow.vue';
import TransactionBrowserPage from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserPage.vue';

/* Props */
const props = defineProps<{
  entries: TransactionBrowserEntry[];
}>();

/* State */
const currentPage = ref(1);
const pageSize = ref(10);
const showDetailsModal = ref(false);
const detailedItemIndex = ref(-1);

/* Computed */
const pageStart = computed(() => (currentPage.value - 1) * pageSize.value);
const pagedEntries = computed(() => {
  return props.entries.slice(pageStart.value, pageStart.value + pageSize.value);
});
const showStatusColumn = computed(() => props.entries.some(entry => entry.fullySignedByUser));

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
        <th v-if="showStatusColumn" class="text-center">Signed</th>
        <th>Transaction ID</th>
        <th>Transaction Type</th>
        <th>Description</th>
        <th>Valid Start</th>
        <th>Creator email</th>
        <th class="text-center">Action</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="(entry, index) of pagedEntries" :key="pageStart + index">
        <TransactionBrowserRow
          :entry="entry"
          :index="pageStart + index"
          :show-status-column="showStatusColumn"
          @details="handleDetails"
        />
      </template>
    </tbody>
    <tfoot v-if="entries.length > pageSize" class="d-table-caption">
      <tr class="d-inline">
        <AppPager
          v-model:current-page="currentPage"
          v-model:per-page="pageSize"
          :total-items="entries.length"
        />
      </tr>
    </tfoot>
  </table>

  <TransactionBrowserPage
    v-if="showDetailsModal && detailedItemIndex !== -1"
    v-model:current-index="detailedItemIndex"
    v-model:show="showDetailsModal"
    :entries="entries"
    @next="detailedItemIndex += 1"
    @previous="detailedItemIndex -= 1"
  />
</template>
