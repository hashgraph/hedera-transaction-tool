<script setup lang="ts">
import type { TabItem } from '@renderer/components/ui/AppTabs.vue';
import AppTabs from '@renderer/components/ui/AppTabs.vue';

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

import { getTransactionsToApprove } from '@renderer/services/organization';

import { isLoggedInOrganization, isOrganizationActive } from '@renderer/utils';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';

import History from './components/History.vue';
import Drafts from './components/Drafts.vue';
import InProgress from './components/InProgress.vue';
import ReadyForExecution from './components/ReadyForExecution.vue';
import ReadyForReview from './components/ReadyForReview.vue';
import useLoader from '@renderer/composables/useLoader';
import TransactionImportButton from '@renderer/components/TransactionImportButton.vue';
import { TransactionNodeCollection } from '../../../../../middle-end/src/ITransactionNode.ts';
import TransactionNodeTable from '@renderer/pages/Transactions/components/TransactionNodeTable.vue';

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
  let rawTabItems: TabItem[];
  if (isOrganizationActive(user.selectedOrganization)) {
    rawTabItems = [...organizationTabs];
  } else {
    rawTabItems = [...sharedTabs];
  }

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

const selectedTabTitle = computed(() => {
  const tabParam = router.currentRoute.value.query.tab;
  return typeof tabParam == 'string' ? tabParam : null;
});

const selectedTabIndex = computed(() => {
  const result = activeTabs.value.findIndex(tabItem => tabItem.title === selectedTabTitle.value);
  return result != -1 ? result : null;
});

/* Function */

async function setQueryTabAndRemount(title: string) {
  const query = router.currentRoute.value.query;
  if (query.tab === title) return;
  await router.replace({ query: { ...query, tab: title } });
  // Triggers unmount() + remount()
}

async function findPrimaryTabTitle(): Promise<string> {
  /*
     Primary tab is the one that is displayed when:
     - after application startup
     - after user selected another organization

      Organization | Primary tab
     --------------|-------------------------------------------------------------------
      Personal     | 'History'
     --------------|-------------------------------------------------------------------
      Org          | if some transactions are available for approval
                   |        'Ready for Review'
                   | else
                   |        'Ready to Sign' else
     --------------|-------------------------------------------------------------------
   */

  if (!isLoggedInOrganization(user.selectedOrganization)) return historyTitle;
  if (user.selectedOrganization.isPasswordTemporary) return historyTitle;

  const { totalItems } = await getTransactionsToApprove(
    user.selectedOrganization.serverUrl,
    network.network,
    1,
    1,
    [],
  );

  return totalItems > 0 ? readyForReviewTitle : readyToSignTitle;
}

async function handleTabSelection(newSelectedTabIndex: number) {
  if (newSelectedTabIndex != selectedTabIndex.value) {
    await setQueryTabAndRemount(activeTabs.value[newSelectedTabIndex].title);
  }
}

async function organizationDidChange() {
  await withLoader(async () => {
    const newPrimaryTabTitle = await findPrimaryTabTitle();
    if (newPrimaryTabTitle !== selectedTabTitle.value) {
      await setQueryTabAndRemount(newPrimaryTabTitle);
    }
  });
}

/* Hooks */
onBeforeMount(async () => {
  if (selectedTabTitle.value === null) {
    // tab title is not set in current route => we set it with the primary title
    await setQueryTabAndRemount(await findPrimaryTabTitle());
  } else {
    watch(() => user.selectedOrganization, organizationDidChange);
  }
});
</script>

<template>
  <div class="flex-column-100 p-5">
    <div class="d-flex justify-content-between">
      <h1 class="text-title text-bold">Transactions</h1>

      <div class="flex-centered gap-4">
        <div class="dropdown">
          <AppButton color="primary" data-testid="button-create-new" data-bs-toggle="dropdown"
            ><i class="bi bi-plus-lg"></i> <span>Create New</span></AppButton
          >
          <ul class="dropdown-menu mt-3">
            <li
              class="dropdown-item cursor-pointer"
              @click="isTransactionSelectionModalShown = true"
            >
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
        <div>
          <TransactionImportButton />
        </div>
      </div>
    </div>

    <div class="position-relative flex-column-100 overflow-hidden mt-4">
      <div class="mb-3">
        <AppTabs
          v-if="selectedTabIndex !== null"
          :items="activeTabs"
          :active-index="selectedTabIndex"
          @update:active-index="handleTabSelection"
        ></AppTabs>
      </div>
      <template v-if="selectedTabTitle === readyForReviewTitle"><ReadyForReview /></template>
      <template v-if="selectedTabTitle === readyToSignTitle">
        <TransactionNodeTable :collection="TransactionNodeCollection.READY_TO_SIGN" />
      </template>
      <template v-if="selectedTabTitle === inProgressTitle"><InProgress /></template>
      <template v-if="selectedTabTitle === readyForExecutionTitle"><ReadyForExecution /></template>
      <template v-if="selectedTabTitle === draftsTitle"><Drafts /></template>
      <template v-if="selectedTabTitle === historyTitle"><History /></template>
    </div>

    <TransactionSelectionModal
      v-if="isTransactionSelectionModalShown"
      v-model:show="isTransactionSelectionModalShown"
      :group="false"
    />
  </div>
</template>
