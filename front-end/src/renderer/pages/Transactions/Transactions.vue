<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRoute } from 'vue-router';

import { isOrganizationActive } from '@renderer/utils/userStoreHelpers';

import AppTabs, { TabItem } from '@renderer/components/ui/AppTabs.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';

import History from './components/History.vue';
import Drafts from './components/Drafts.vue';
import ReadyToSign from './components/ReadyToSign.vue';
import InProgress from './components/InProgress.vue';
import ReadyForExecution from './components/ReadyForExecution.vue';
import ReadyForReview from './components/ReadyForReview.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const route = useRoute();

/* State */
const organizationTabs: TabItem[] = [
  { title: 'Drafts' },
  { title: 'Ready for Review' },
  { title: 'Ready to Sign' },
  { title: 'In Progress' },
  { title: 'Ready for Execution' },
  { title: 'History' },
];
const sharedTabs: TabItem[] = [{ title: 'Drafts' }, { title: 'History' }];

const activeTabIndex = ref(1);
const tabItems = ref<TabItem[]>(sharedTabs);
const isTransactionSelectionModalShown = ref(false);

/* Computed */
const activeTabTitle = computed(() => tabItems.value[activeTabIndex.value].title);

/* Function */
function setTabItems() {
  if (isOrganizationActive(user.selectedOrganization)) {
    const currentTabTitle = activeTabTitle.value;
    tabItems.value = [...organizationTabs];
    const newIndex = tabItems.value.findIndex(tab => tab.title === currentTabTitle);
    activeTabIndex.value = newIndex >= 0 ? newIndex : 0;
  } else {
    const newIndex = sharedTabs.findIndex(tab => tab.title === activeTabTitle.value);
    activeTabIndex.value = newIndex >= 0 ? newIndex : 0;
    tabItems.value = [...sharedTabs];
  }
}

/* Hooks */
onBeforeMount(() => {
  setTabItems();

  const tab = route.query.tab?.toString();
  if (tab) {
    const newIndex = tabItems.value.findIndex(t => t.title === tab);
    activeTabIndex.value = newIndex >= 0 ? newIndex : activeTabIndex.value;
  }
});

/* Watchers */
watch(
  () => user.selectedOrganization,
  () => {
    setTabItems();
  },
);
</script>

<template>
  <div class="flex-column-100 p-5">
    <div class="d-flex justify-content-between">
      <h1 class="text-title text-bold">Transactions</h1>
      <AppButton
        color="primary"
        data-testid="button-create-new"
        @click="isTransactionSelectionModalShown = true"
      >
        <i class="bi bi-plus-lg"></i> <span>Create New</span>
      </AppButton>
    </div>

    <div class="position-relative flex-column-100 overflow-hidden mt-4">
      <div class="mb-3">
        <AppTabs :items="tabItems" v-model:active-index="activeTabIndex"></AppTabs>
      </div>
      <template v-if="activeTabTitle === 'Ready for Review'"><ReadyForReview /></template>
      <template v-if="activeTabTitle === 'Ready to Sign'"> <ReadyToSign /> </template>
      <template v-if="activeTabTitle === 'In Progress'"><InProgress /></template>
      <template v-if="activeTabTitle === 'Ready for Execution'"><ReadyForExecution /></template>
      <template v-if="activeTabTitle === 'Drafts'"><Drafts /></template>
      <template v-if="activeTabTitle === 'History'"><History /></template>
    </div>

    <TransactionSelectionModal v-model:show="isTransactionSelectionModalShown" />
  </div>
</template>
