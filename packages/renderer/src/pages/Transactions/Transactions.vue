<script setup lang="ts">
import {computed, ref} from 'vue';

import type {TabItem} from '@renderer/components/ui/AppTabs.vue';
import AppTabs from '@renderer/components/ui/AppTabs.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import History from './components/History.vue';
import TransactionSelectionModal from './components/TransactionSelectionModal.vue';
import Drafts from './components/Drafts.vue';

/* State */
const tabItems = ref<TabItem[]>([
  // { title: 'Ready for Review' },
  // { title: 'Ready to Sign' },
  // { title: 'In Progress' },
  // { title: 'Ready for Submission' },
  {title: 'Drafts'},
  {title: 'History'},
]);
const activeTabIndex = ref(1);
const isTransactionSelectionModalShown = ref(false);

/* Computed */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);
</script>

<template>
  <div class="p-5">
    <div class="d-flex justify-content-between">
      <h1 class="text-title text-bold">Transactions</h1>
      <AppButton
        color="primary"
        @click="isTransactionSelectionModalShown = true"
      >
        <i class="bi bi-plus-lg"></i> <span>Create New</span>
      </AppButton>
    </div>

    <div class="mt-4">
      <AppTabs
        v-model:active-index="activeTabIndex"
        :items="tabItems"
      ></AppTabs>
      <!-- <template v-if="activeTabTitle === 'Ready for Review'"></template>
      <template v-if="activeTabTitle === 'Ready to Sign'"> </template>
      <template v-if="activeTabTitle === 'In Progress'"></template>
      <template v-if="activeTabTitle === 'Ready for Submission'"></template> -->
      <template v-if="activeTabTitle === 'Drafts'"><Drafts /></template>
      <template v-if="activeTabTitle === 'History'"><History /></template>
    </div>

    <TransactionSelectionModal v-model:show="isTransactionSelectionModalShown" />
  </div>
</template>
