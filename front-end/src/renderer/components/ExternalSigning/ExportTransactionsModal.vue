<script lang="ts" setup>
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { ref } from 'vue';
import type { ITransaction, TransactionFile } from '@shared/interfaces';
import { writeTransactionFile } from '@renderer/services/transactionFileService.ts';
import { flattenNodeCollection } from '@shared/utils/transactionFile.ts';
import useUserStore from '@renderer/stores/storeUser.ts';
import useNetworkStore from '@renderer/stores/storeNetwork';
import {
  assertIsLoggedInOrganization,
  computeSignatureKey,
  hexToUint8Array,
  isLoggedInOrganization,
} from '@renderer/utils';
import {
  generateTransactionExportContentV2,
  generateTransactionExportFileName,
} from '@renderer/services/organization';
import { showSaveDialog } from '@renderer/services/electronUtilsService.ts';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '../../../../../shared/src/ITransactionNode.ts';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppCheckBox from '@renderer/components/ui/AppCheckBox.vue';
import { getTransactionNodes } from '@renderer/services/organization/transactionNode.ts';
import { errorToastOptions } from '@renderer/utils/toastOptions.ts';
import { useToast } from 'vue-toast-notification';
import { Transaction } from '@hashgraph/sdk';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';

/* Models */
const show = defineModel<boolean>('show', { required: true });

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();

/* Injected */
const accountInfoCache = AccountByIdCache.inject();
const nodeInfoCache = NodeByIdCache.inject();

/* State */
const isOnlyExternalSelected = ref(false);

/* Handlers */
async function handleExport() {
  assertIsLoggedInOrganization(user.selectedOrganization);

  const collectionNodes = await fetchNodes();
  console.log(`Fetched ${collectionNodes.length} nodes`);

  let collectionTransactions: ITransaction[] = await flattenNodeCollection(
    collectionNodes,
    user.selectedOrganization.serverUrl,
  );
  console.log(`Flattened ${collectionTransactions.length} transactions`);

  if (isOnlyExternalSelected.value) {
    const filteredTransactions: ITransaction[] = [];
    for (const tx of collectionTransactions) {
      const sdkTransaction = Transaction.fromBytes(hexToUint8Array(tx.transactionBytes));
      const mirrorNodeLink = network.getMirrorNodeREST(network.network);
      const audit = await computeSignatureKey(
        sdkTransaction,
        mirrorNodeLink,
        accountInfoCache,
        nodeInfoCache,
        user.selectedOrganization,
      );
      if (audit.externalKeys.size > 0) {
        filteredTransactions.push(tx);
      }
    }
    collectionTransactions = filteredTransactions;

    console.log(`Filtered ${collectionTransactions.length} external transactions`);
  }

  show.value = false;

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

/* Functions */
async function fetchNodes(): Promise<ITransactionNode[]> {
  let nodes: ITransactionNode[];
  if (isLoggedInOrganization(user.selectedOrganization)) {
    try {
      nodes = await getTransactionNodes(
        user.selectedOrganization.serverUrl,
        TransactionNodeCollection.IN_PROGRESS,
        network.network,
        [],
        [],
      );
    } catch {
      nodes = [];
      toast.error('Failed to fetch Transactions to export', errorToastOptions);
    }
  } else {
    nodes = [];
  }
  return nodes;
}
</script>

<template>
  <AppModal v-model:show="show">
    <div class="p-4">
      <i class="bi bi-x-lg d-inline-block cursor-pointer" @click="show = false"></i>
      <div class="text-center">
        <AppCustomIcon :name="'questionMark'" style="height: 80px" />
      </div>
      <h3 class="text-center text-title text-bold mt-4">Export Transactions</h3>
      <div class="text-center mt-4">
        Do you want to export all transactions currently in progress?
      </div>
      <div class="d-flex align-items-center justify-content-center gap-2 mt-4">
        <AppCheckBox
          v-model:checked="isOnlyExternalSelected"
          class="cursor-pointer"
          data-testid="checkbox-select-external"
          name="select-external"
        />
        <span class="text-small text-secondary"
          >Select only transactions waiting for external signer</span
        >
      </div>
      <hr class="separator my-5" />
      <div class="flex-between-centered gap-4">
        <AppButton color="borderless" data-testid="button-cancel-export" @click="show = false"
          >Cancel</AppButton
        >
        <AppButton color="primary" data-testid="button-confirm-export" @click="handleExport"
          >Confirm</AppButton
        >
      </div>
    </div>
  </AppModal>
</template>
