<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { showOpenDialog } from '@renderer/services/electronUtilsService.ts';
import { filterForImportV1 } from '@renderer/services/importV1.ts';
import type { ISignatureImport, V1ImportFilterResult } from '@shared/interfaces';
import TransactionImportModal from '@renderer/components/TransactionImportModal.vue';
import { useToast } from 'vue-toast-notification';
import { assertIsLoggedInOrganization, hexToUint8Array } from '@renderer/utils';
import useUserStore from '@renderer/stores/storeUser.ts';
import { readTransactionFile } from '@renderer/services/transactionFile.ts';
import { SignatureMap, Transaction } from '@hashgraph/sdk';
import { getTransactionById, importSignatures } from '@renderer/services/organization';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

const IMPORT_FORMATS = [
  { name: 'All Tx Tool files', extensions: ['tx2', 'zip'] },
  { name: 'TX2 (Tx Tool 2.0)', extensions: ['tx2'] },
  { name: 'ZIP (Tx Tool 1.0)', extensions: ['zip'] },
];

/*Composables*/
const toast = useToast();

/* Stores */
const user = useUserStore();

/* State */
const emptyFilterResult: V1ImportFilterResult = { candidates: [], ignoredPaths: [] };
const filterResult = ref<V1ImportFilterResult>(emptyFilterResult);
const isImportModalVisible = ref(false);
const isFailureModalVisible = ref(false);
const unknownTransactionIds = ref<string[]>([]);

/* Handlers */
async function handleImport() {
  const result = await showOpenDialog(
    'Import Signatures from Transaction File',
    'Select',
    IMPORT_FORMATS,
    ['openFile' /*, 'openDirectory', 'multiSelections' */],
    'Select a .tx2 file (created by TT V2) or a .zip file (created by TT V1)',
  );

  if (result.canceled) return;

  const selectedPath = result.filePaths[0];
  const lastDot = selectedPath.lastIndexOf('.');
  const ext = (lastDot === -1) ? '' : selectedPath.slice(lastDot).toLowerCase();

  if (ext === '.tx2') {
    await importSignaturesFromV2File(selectedPath);
  } else if (ext === '.zip') {
    filterResult.value = await filterForImportV1(result.filePaths);
    isImportModalVisible.value = true;
  } else {
    toast.error(`Unsupported file extension: ${ext}`, errorToastOptions);
  }
}

async function importSignaturesFromV2File(filePath: string) {
  assertIsLoggedInOrganization(user.selectedOrganization);

  const transactionFile = await readTransactionFile(filePath);
  const importInputs: ISignatureImport[] = [];

  for (const item of transactionFile.items) {
    const transactionBytes = hexToUint8Array(item.transactionBytes);
    const sdkTransaction = Transaction.fromBytes(transactionBytes);

    const map = SignatureMap._fromTransaction(sdkTransaction);

    const transactionId = sdkTransaction.transactionId;
    try {
      const transaction = await getTransactionById(
        user.selectedOrganization.serverUrl,
        transactionId!,
      );
      importInputs.push({
        id: transaction.id,
        signatureMap: map,
      });
    }catch  {
      unknownTransactionIds.value.push(transactionId!.toString())
    }
  }

  if (unknownTransactionIds.value.length > 0) {
    isFailureModalVisible.value = true;
  } else {
    // console.log('importSignatures: INPUTS', JSON.stringify(importInputs));
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
    // console.log('importSignatures: RESULTS', JSON.stringify(importResults));
  }
}
</script>

<template>
  <AppButton
    color="primary"
    data-testid="button-transaction-page-import"
    data-bs-toggle="dropdown"
    @click="handleImport"
  >
    <span>Import Signatures</span>
  </AppButton>

  <TransactionImportModal v-model:show="isImportModalVisible" :filter-result="filterResult" />

  <AppModal
    v-if="isFailureModalVisible  && unknownTransactionIds.length > 0"
    v-model:show="isFailureModalVisible" class="common-modal">
    <form class="p-5" @submit.prevent="isFailureModalVisible = false">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click.prevent="isFailureModalVisible = false"></i>
      </div>
      <div class="text-center">
        <AppCustomIcon :name="'error'" style="height: 80px" />
      </div>
      <h3 class="text-center text-title text-bold mt-4">Failed to import signatures</h3>
      <div v-if="unknownTransactionIds.length === 1" class="text-center text-secondary mt-4">
        The file you selected contains signatures related to a transaction which could not be found in this organization: {{unknownTransactionIds[0]}}
      </div>
      <div v-else class="text-center text-secondary mt-4">
        The file you selected contains signatures related to transactions which could not be found in this organization.
      </div>
      <div class="text-center text-small text-muted mt-4">
        You might have either selected the wrong file or logged to the wrong organization.
      </div>
      <div class="d-grid mt-5">
        <AppButton color="primary" data-testid="button-close" type="submit">Close</AppButton>
      </div>
    </form>
  </AppModal>

</template>

<style scoped></style>
