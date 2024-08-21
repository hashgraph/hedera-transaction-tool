<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';

import { NotificationType } from '@main/shared/interfaces';

import useUserStore from '@renderer/stores/storeUser';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { useRoute } from 'vue-router';
import useSetDynamicLayout from '@renderer/composables/useSetDynamicLayout';

import { isOrganizationActive } from '@renderer/utils/userStoreHelpers';

import AppTabs, { TabItem } from '@renderer/components/ui/AppTabs.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';

import History from './components/History.vue';
import Drafts from './components/Drafts.vue';
import Groups from './components/Groups.vue';
import ReadyToSign from './components/ReadyToSign.vue';
import InProgress from './components/InProgress.vue';
import ReadyForExecution from './components/ReadyForExecution.vue';
import ReadyForReview from './components/ReadyForReview.vue';

/* Stores */
const user = useUserStore();
const notifications = useNotificationsStore();

/* Composables */
const route = useRoute();
useSetDynamicLayout({
  loggedInClass: true,
  shouldSetupAccountClass: false,
  showMenu: true,
});

/* State */
const organizationTabs: TabItem[] = [
  { title: 'Drafts' },
  { title: 'Ready for Review' },
  { title: 'Ready to Sign' },
  { title: 'In Progress' },
  { title: 'Ready for Execution' },
  { title: 'History' },
  { title: 'Groups' },
];
const sharedTabs: TabItem[] = [{ title: 'Drafts' }, { title: 'History' }, { title: 'Groups' }];

const activeTabIndex = ref(1);
const tabItems = ref<TabItem[]>(sharedTabs);
const isTransactionSelectionModalShown = ref(false);

/* Computed */
const activeTabs = computed(() => {
  const rawTabItems = tabItems.value;

  const readyToApproveNotifications = notifications.notifications.filter(
    nr => nr.notification.type === NotificationType.TRANSACTION_INDICATOR_APPROVE,
  );

  const readyToSignNotifications = notifications.notifications.filter(
    nr => nr.notification.type === NotificationType.TRANSACTION_INDICATOR_SIGN,
  );

  const readyForExecutionNotifications = notifications.notifications.filter(
    nr => nr.notification.type === NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
  );

  const historyNotifications = notifications.notifications.filter(
    nr =>
      nr.notification.type === NotificationType.TRANSACTION_INDICATOR_EXECUTED ||
      nr.notification.type === NotificationType.TRANSACTION_INDICATOR_EXPIRED,
  );

  rawTabItems.forEach(tab => {
    switch (tab.title) {
      case 'Ready for Review':
        tab.notifications = readyToApproveNotifications.length || undefined;
        break;
      case 'Ready to Sign':
        tab.notifications = readyToSignNotifications.length || undefined;
        break;
      case 'Ready for Execution':
        tab.notifications = readyForExecutionNotifications.length || undefined;
        break;
      case 'History':
        tab.notifications = historyNotifications.length || undefined;
        break;
    }
  });

  return rawTabItems;
});
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
      <div class="dropdown">
        <AppButton color="primary" data-testid="button-create-new" data-bs-toggle="dropdown"
          ><i class="bi bi-plus-lg"></i> <span>Create New</span></AppButton
        >
        <ul class="dropdown-menu mt-3">
          <li class="dropdown-item cursor-pointer" @click="isTransactionSelectionModalShown = true">
            <span class="text-small text-bold" data-testid="span-single-transaction"
              >Transaction</span
            >
          </li>
          <li
            class="dropdown-item cursor-pointer mt-3"
            @click="$router.push('create-transaction-group')"
          >
            <span class="text-small text-bold" data-testid="span-group-transaction"
              >Transaction Group</span
            >
          </li>
        </ul>
      </div>
    </div>

    <div class="position-relative flex-column-100 overflow-hidden mt-4">
      <div class="mb-3">
        <AppTabs :items="activeTabs" v-model:active-index="activeTabIndex"></AppTabs>
      </div>
      <template v-if="activeTabTitle === 'Ready for Review'"><ReadyForReview /></template>
      <template v-if="activeTabTitle === 'Ready to Sign'"> <ReadyToSign /> </template>
      <template v-if="activeTabTitle === 'In Progress'"><InProgress /></template>
      <template v-if="activeTabTitle === 'Ready for Execution'"><ReadyForExecution /></template>
      <template v-if="activeTabTitle === 'Drafts'"><Drafts /></template>
      <template v-if="activeTabTitle === 'History'"><History /></template>
      <template v-if="activeTabTitle === 'Groups'"><Groups /></template>
    </div>

    <TransactionSelectionModal v-model:show="isTransactionSelectionModalShown" :group="false" />
  </div>
</template>
