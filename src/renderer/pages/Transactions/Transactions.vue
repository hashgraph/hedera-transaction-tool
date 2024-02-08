<script setup lang="ts">
import { computed, ref } from 'vue';

import AppTabs, { TabItem } from '@renderer/components/ui/AppTabs.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import History from './components/History.vue';
import TransactionSelectionModal from './components/TransactionSelectionModal.vue';

/* State */
const tabItems = ref<TabItem[]>([
  // { title: 'Ready for Review' },
  // { title: 'Ready to Sign' },
  // { title: 'In Progress' },
  // { title: 'Ready for Submission' },
  { title: 'Drafts' },
  { title: 'History' },
]);
const activeTabIndex = ref(1);
const isTransactionSelectionModalShown = ref(false);

/* Computed */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);
</script>

<template>
  <div class="p-5">
    <h1 class="text-title text-bold">Transactions</h1>
    <div class="mt-7 d-flex">
      <AppButton
        color="primary"
        class="d-flex align-items-center"
        @click="isTransactionSelectionModalShown = true"
      >
        <span>Create</span> <i class="bi bi-plus text-subheader ms-2"></i
      ></AppButton>
    </div>
    <div class="mt-4">
      <AppTabs :items="tabItems" v-model:active-index="activeTabIndex"></AppTabs>
      <!-- <template v-if="activeTabTitle === 'Ready for Review'"></template>
      <template v-if="activeTabTitle === 'Ready to Sign'"> </template>
      <template v-if="activeTabTitle === 'In Progress'"></template>
      <template v-if="activeTabTitle === 'Ready for Submission'"></template> -->
      <template v-if="activeTabTitle === 'Drafts'"></template>
      <template v-if="activeTabTitle === 'History'"><History /></template>
    </div>

    <TransactionSelectionModal v-model:show="isTransactionSelectionModalShown" />
  </div>
</template>
