<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import AppTabs, { TabItem } from '@renderer/components/ui/AppTabs.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';

import History from './components/History.vue';
import Drafts from './components/Drafts.vue';

/* Stores */
const user = useUserStore();

/* State */
const organizationOnlyTabs: TabItem[] = [
  { title: 'Ready for Review' },
  { title: 'Ready to Sign' },
  { title: 'In Progress' },
  { title: 'Ready for Submission' },
];
const sharedTabs: TabItem[] = [{ title: 'Drafts' }, { title: 'History' }];

const activeTabIndex = ref(1);
const tabItems = ref<TabItem[]>(sharedTabs);
const isTransactionSelectionModalShown = ref(false);

/* Computed */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);

/* Function */
function setTabItems() {
  if (user.data.activeOrganization) {
    const currentTabTitle = activeTabTitle.value;
    tabItems.value = [...organizationOnlyTabs, ...sharedTabs];
    const newIndex = tabItems.value.findIndex(tab => tab.title === currentTabTitle);
    activeTabIndex.value = newIndex >= 0 ? newIndex : 0;
  } else {
    const newIndex = sharedTabs.findIndex(tab => tab.title === activeTabTitle.value);
    activeTabIndex.value = newIndex >= 0 ? newIndex : 0;
    tabItems.value = sharedTabs;
  }
}

/* Hooks */
onMounted(() => {
  setTabItems();
});

/* Watchers */
watch(
  () => user.data.activeOrganization,
  () => {
    setTabItems();
  },
);
</script>

<template>
  <div class="flex-column-100 p-5">
    <div class="d-flex justify-content-between">
      <h1 class="text-title text-bold">Transactions</h1>
      <AppButton color="primary" @click="isTransactionSelectionModalShown = true">
        <i class="bi bi-plus-lg"></i> <span>Create New</span>
      </AppButton>
    </div>

    <div class="position-relative flex-column-100 overflow-hidden mt-4">
      <AppTabs :items="tabItems" v-model:active-index="activeTabIndex"></AppTabs>
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
