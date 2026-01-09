<script setup lang="ts">
import type { TabItem } from '@renderer/components/ui/AppTabs.vue';
import AppTabs from '@renderer/components/ui/AppTabs.vue';

import { computed, onBeforeMount, ref, watch } from 'vue';

import {
  type ISignatureImport,
  type ITransaction,
  NotificationType,
  type TransactionFile,
} from '@shared/interfaces';
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

import {
  assertIsLoggedInOrganization,
  hexToUint8Array,
  isLoggedInOrganization,
  isOrganizationActive,
} from '@renderer/utils';
import AppButton from '@renderer/components/ui/AppButton.vue';
import TransactionSelectionModal from '@renderer/components/TransactionSelectionModal.vue';
import Drafts from './components/Drafts.vue';
import useLoader from '@renderer/composables/useLoader';
import TransactionImportButton from '@renderer/components/TransactionImportButton.vue';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../shared/src/ITransactionNode.ts';
import TransactionNodeTable from '@renderer/pages/Transactions/components/TransactionNodeTable.vue';
import History from '@renderer/pages/Transactions/components/History.vue';
import { getTransactionNodes } from '@renderer/services/organization/transactionNode.ts';
import AppDropDown from '@renderer/components/ui/AppDropDown.vue';
import SignTransactionFileModal from '@renderer/components/ExternalSigning/SignTransactionFileModal.vue';
import { showOpenDialog, showSaveDialog } from '@renderer/services/electronUtilsService.ts';
import {
  generateTransactionExportContentV2,
  generateTransactionExportFileName,
  getTransactionById,
  importSignatures,
} from '@renderer/services/organization';
import { readTransactionFile, writeTransactionFile } from '@renderer/services/transactionFile.ts';
import { SignatureMap, Transaction } from '@hashgraph/sdk';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';
import { useToast } from 'vue-toast-notification';
import { flattenNodeCollection } from '@shared/utils/transactionFile.ts';

/* Stores */
const user = useUserStore();
const network = useNetworkStore();
const notifications = useNotificationsStore();

/* Composables */
const toast = useToast();
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
const isSignTransactionFileModalShown = ref(false);

const collectionNodes = ref<ITransactionNode[]>([]);
const transactionFilePath = ref<string | null>(null);

/* Computed */
const dropDownMenuItems = computed(() => {
  let result: { label: string; value: string }[];
  if (isLoggedInOrganization(user.selectedOrganization)) {
    result = [
      { label: 'Export', value: 'export' },
      { label: 'Sign Transactions from File', value: 'signTransactionFile' },
      { label: 'Import Signatures from File', value: 'importTransactionFile' },
    ];
  } else {
    result = [{ label: 'Sign Transactions from File', value: 'signTransactionFile' }];
  }
  return result;
});

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

/* Handlers */
async function handleTransactionFileAction(action: string) {
  switch (action) {
    case 'export':
      await createTransactionFile();
      break;
    case 'signTransactionFile':
      transactionFilePath.value = await selectTransactionFile();
      if (transactionFilePath.value !== null) {
        isSignTransactionFileModalShown.value = true;
      }
      break;
    case 'importTransactionFile':
      await importSignaturesFromFile();
      break;
  }
}

/* Functions */
async function importSignaturesFromFile() {
  assertIsLoggedInOrganization(user.selectedOrganization);

  transactionFilePath.value = await selectTransactionFile();
  if (transactionFilePath.value !== null) {
    const transactionFile = await readTransactionFile(transactionFilePath.value);
    const importInputs: ISignatureImport[] = [];

    for (const item of transactionFile.items) {
      const transactionBytes = hexToUint8Array(item.transactionBytes);
      const sdkTransaction = Transaction.fromBytes(transactionBytes);

      const map = SignatureMap._fromTransaction(sdkTransaction);
      console.log(`importSignatures: SignatureMap`, map.toJSON());

      const transactionId = sdkTransaction.transactionId;
      const transaction = await getTransactionById(
        user.selectedOrganization.serverUrl,
        transactionId!,
      );

      importInputs.push({
        id: transaction.id,
        signatureMap: map,
      });
    }

    console.log('importSignatures: INPUTS', JSON.stringify(importInputs));

    const importResults = await importSignatures(user.selectedOrganization, importInputs);
    let failedImportCount = 0;
    let successfulImportCount = 0;
    for (const result of importResults) {
      if (result.error) {
        failedImportCount++;
      } else {
        successfulImportCount++;
      }
    }
    if (failedImportCount > 0) {
      toast.error(
        `Failed to import signatures for ${failedImportCount} transaction${failedImportCount > 1 ? 's' : ''}`,
        errorToastOptions,
      );
    } else {
      toast.success(
        `Successfully imported signatures for ${successfulImportCount} transaction${successfulImportCount > 1 ? 's' : ''}`,
        successToastOptions,
      );
    }

    console.log('importSignatures: RESULTS', JSON.stringify(importResults));
  }
}

async function createTransactionFile() {
  assertIsLoggedInOrganization(user.selectedOrganization);

  const collectionTransactions: ITransaction[] = await flattenNodeCollection(
    collectionNodes.value,
    user.selectedOrganization.serverUrl,
  );

  if (collectionTransactions.length > 0) {
    const baseName = generateTransactionExportFileName(collectionTransactions[0]);

    // Show the save dialog to the user, allowing them to choose the file name and location
    const { filePath, canceled } = await showSaveDialog(
      `${baseName}.tx2`,
      'Export transactions',
      'Export',
      [],
      'Export transaction',
    );

    if (!canceled) {
      const tx2Content: TransactionFile = generateTransactionExportContentV2(
        collectionTransactions,
        network.network,
      );
      await writeTransactionFile(tx2Content, filePath);
    }
  }
}

async function selectTransactionFile(): Promise<string | null> {
  const result = await showOpenDialog(
    'Sign Transaction File',
    'Select',
    [{ name: '.tx2', extensions: ['tx2'] }],
    ['openFile'],
    'Select .tx2 files exported by TT V2',
  );

  return result.canceled ? null : result.filePaths[0];
}

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
                   |        'Ready to Sign'
     --------------|-------------------------------------------------------------------
   */

  if (!isLoggedInOrganization(user.selectedOrganization)) return historyTitle;
  if (user.selectedOrganization.isPasswordTemporary) return historyTitle;

  const nodes = await getTransactionNodes(
    user.selectedOrganization.serverUrl,
    TransactionNodeCollection.READY_FOR_REVIEW,
    network.network,
    [],
    [],
  );

  return nodes.length > 0 ? readyForReviewTitle : readyToSignTitle;
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

        <div>
          <AppDropDown
            :color="'secondary'"
            :items="dropDownMenuItems"
            compact
            data-testid="button-more-dropdown-sm"
            @select="handleTransactionFileAction($event)"
          />
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
      <template v-if="selectedTabTitle === readyForReviewTitle">
        <TransactionNodeTable
          :collection="TransactionNodeCollection.READY_FOR_REVIEW"
          @nodes-fetched="collectionNodes = $event"
        />
      </template>
      <template v-if="selectedTabTitle === readyToSignTitle">
        <TransactionNodeTable
          :collection="TransactionNodeCollection.READY_TO_SIGN"
          @nodes-fetched="collectionNodes = $event"
        />
      </template>
      <template v-if="selectedTabTitle === inProgressTitle">
        <TransactionNodeTable
          :collection="TransactionNodeCollection.IN_PROGRESS"
          @nodes-fetched="collectionNodes = $event"
        />
      </template>
      <template v-if="selectedTabTitle === readyForExecutionTitle">
        <TransactionNodeTable
          :collection="TransactionNodeCollection.READY_FOR_EXECUTION"
          @nodes-fetched="collectionNodes = $event"
        />
      </template>
      <template v-if="selectedTabTitle === draftsTitle"><Drafts /></template>
      <template v-if="selectedTabTitle === historyTitle">
        <TransactionNodeTable
          v-if="user.selectedOrganization"
          :collection="TransactionNodeCollection.HISTORY"
          @nodes-fetched="collectionNodes = $event"
        />
        <History v-else />
      </template>
    </div>

    <TransactionSelectionModal
      v-if="isTransactionSelectionModalShown"
      v-model:show="isTransactionSelectionModalShown"
      :group="false"
    />

    <SignTransactionFileModal
      v-if="isSignTransactionFileModalShown"
      v-model:show="isSignTransactionFileModalShown"
      :filePath="transactionFilePath"
    />
  </div>
</template>
