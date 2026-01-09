<script setup lang="ts">
import { computed, ref } from 'vue';
import AppPager from '@renderer/components/ui/AppPager.vue';
import type { ITransactionBrowserItem } from './ITransactionBrowserItem';
import TransactionBrowserRow from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserRow.vue';

/* Props */
const props = defineProps<{
  items: ITransactionBrowserItem[];
}>();

/* Emits */
const emit = defineEmits(['navigate']);

/* State */
const currentPage = ref(1);
const pageSize = ref(15);

/* Computed */
const pageStart = computed(() => (currentPage.value - 1) * pageSize.value);
const pagedItems = computed(() => {
  return props.items.slice(pageStart.value, pageStart.value + pageSize.value);
});

/* Handlers */
const handleNavigate = (index: number) => {
  emit('navigate', index);
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
        <TransactionBrowserRow :index="pageStart + index" :item="item" @navigate="handleNavigate" />
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
</template>
