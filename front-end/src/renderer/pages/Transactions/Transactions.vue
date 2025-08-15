<script setup lang="ts">
import type { TabItem } from '@renderer/components/ui/AppTabs.vue';

import { computed, onBeforeMount, ref, watch } from 'vue';

import { NotificationType } from '@shared/interfaces';
import {
  draftsTitle,
  historyTitle,
  inProgressTitle,
  readyForExecutionTitle,
  readyForReviewTitle,
  readyToSignTitle,
} from '@shared/constants';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';
import useNotificationsStore from '@renderer/stores/storeNotifications';

import { useRouter } from 'vue-router';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';

import { getTransactionsToSign } from '@renderer/services/organization';

import { isLoggedInOrganization, isOrganizationActive } from '@renderer/utils';

import AppTabs from '@renderer/components/ui/AppTabs.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';

import History from './components/History.vue';
import Drafts from './components/Drafts.vue';
import ReadyToSign from './components/ReadyToSign.vue';
import InProgress from './components/InProgress.vue';
import ReadyForExecution from './components/ReadyForExecution.vue';
import ReadyForReview from './components/ReadyForReview.vue';
import useLoader from '@renderer/composables/useLoader';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const notifications = useNotificationsStore();

/* Composables */
const router = useRouter();
const withLoader = useLoader();
useSetDynamicLayout(LOGGED_IN_LAYOUT);

/* State */
const organizationTabs: TabItem[] = [
  { title: draftsTitle },
  { title: readyForReviewTitle },
  { title: readyToSignTitle },
  { title: inProgressTitle },
  { title: readyForExecutionTitle },
  { title: historyTitle },
];
const sharedTabs: TabItem[] = [{ title: draftsTitle }, { title: historyTitle }];
const notificationsKey = ref(user.selectedOrganization?.serverUrl || '');

const activeTabIndex = ref(1);
const tabItems = ref<TabItem[]>(sharedTabs);
const isTransactionSelectionModalShown = ref(false);

/* Computed */
const networkFilteredNotifications = computed(() => {
  return (
    notifications.notifications[notificationsKey.value]?.filter(
      n => n.notification.additionalData?.network === network.network,
    ) || []
  );
});

const activeTabs = computed(() => {
  const rawTabItems = tabItems.value;

  const readyToApproveNotifications =
    networkFilteredNotifications.value?.filter(
      nr => nr.notification.type === NotificationType.TRANSACTION_INDICATOR_APPROVE,
    ) || [];

  const readyToSignNotifications =
    networkFilteredNotifications.value?.filter(
      nr => nr.notification.type === NotificationType.TRANSACTION_INDICATOR_SIGN,
    ) || [];

  const readyForExecutionNotifications =
    networkFilteredNotifications.value?.filter(
      nr => nr.notification.type === NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
    ) || [];

  const historyNotifications =
    networkFilteredNotifications.value?.filter(
      nr =>
        nr.notification.type === NotificationType.TRANSACTION_INDICATOR_EXECUTED ||
        nr.notification.type === NotificationType.TRANSACTION_INDICATOR_EXPIRED ||
        nr.notification.type === NotificationType.TRANSACTION_INDICATOR_ARCHIVED,
    ) || [];

  rawTabItems.forEach(tab => {
    switch (tab.title) {
      case readyForReviewTitle:
        tab.notifications = readyToApproveNotifications.length || undefined;
        break;
      case readyToSignTitle:
        tab.notifications = readyToSignNotifications.length || undefined;
        break;
      case readyForExecutionTitle:
        tab.notifications = readyForExecutionNotifications.length || undefined;
        break;
      case historyTitle:
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

function setQueryTab(title: string) {
  const query = router.currentRoute.value.query;
  if (query.tab === title) return;
  router.replace({ query: { ...query, tab: title } });
}

async function syncTab(forceCheckSign = false) {
  setTabItems();

  await withLoader(
    async () => {
      const tab = router.currentRoute.value.query.tab?.toString();

      if (tab) {
        const newIndex = tabItems.value.findIndex(t => t.title === tab);
        activeTabIndex.value = newIndex >= 0 ? newIndex : activeTabIndex.value;
      } else {
        await changeTabIfReadyToSign();
      }

      if (forceCheckSign) await changeTabIfReadyToSign();
    },
    'Failed to sync tab',
    10000,
    false,
  );
}

async function changeTabIfReadyToSign() {
  if (!isLoggedInOrganization(user.selectedOrganization)) return;
  if (user.selectedOrganization.isPasswordTemporary) return;

  const { totalItems } = await getTransactionsToSign(
    user.selectedOrganization.serverUrl,
    network.network,
    1,
    1,
    [],
  );

  if (totalItems > 0 && activeTabTitle.value !== readyToSignTitle) {
    setQueryTab(readyToSignTitle);
  } else {
    setQueryTab(activeTabTitle.value);
  }
}

/* Hooks */
onBeforeMount(syncTab);

/* Watchers */
watch(
  () => user.selectedOrganization,
  async () => await syncTab(true),
);
watch(activeTabTitle, setQueryTab);
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
      <template v-if="activeTabTitle === readyForReviewTitle"><ReadyForReview /></template>
      <template v-if="activeTabTitle === readyToSignTitle"> <ReadyToSign /> </template>
      <template v-if="activeTabTitle === inProgressTitle"><InProgress /></template>
      <template v-if="activeTabTitle === readyForExecutionTitle"><ReadyForExecution /></template>
      <template v-if="activeTabTitle === draftsTitle"><Drafts /></template>
      <template v-if="activeTabTitle === historyTitle"><History /></template>
    </div>

    <TransactionSelectionModal
      v-if="isTransactionSelectionModalShown"
      v-model:show="isTransactionSelectionModalShown"
      :group="false"
    />
  </div>
</template>
