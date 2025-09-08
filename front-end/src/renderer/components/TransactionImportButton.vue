<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';
import { showOpenDialog } from '@renderer/services/electronUtilsService.ts';
import { safeAwait } from '@renderer/utils';
import { searchTransactions } from '@renderer/services/transactionService.ts';
import { ref } from 'vue';
import type { TransactionSearchResult } from '@main/services/localUser';
import TransactionImportModal from '@renderer/components/TransactionImportModal.vue';

/* State */
const foundResults = ref<TransactionSearchResult[]>([]);
const isTransactionImportModalVisible = ref(false);

async function handleImport() {
  const result = await showOpenDialog(
    'Select a V2 transaction (.tx2) or a folder or a zip file',
    'Select',
    [{ name: '.tx2, .zip or a folder ', extensions: ['tx2', 'zip'] }],
    ['openFile', 'openDirectory', 'multiSelections'],
    'Import transactions',
  );

  if (result.canceled) return;

  const { data } = await safeAwait(searchTransactions(result.filePaths));
  foundResults.value = data ?? []

  isTransactionImportModalVisible.value = true
}

</script>

<template>
  <AppButton
    color="primary"
    data-testid="button-create-new"
    data-bs-toggle="dropdown"
    @click="handleImport"
  >
    <span>Import</span>
  </AppButton>
  <TransactionImportModal
    v-model:show="isTransactionImportModalVisible"
    :search-results="foundResults"/>
</template>

<style scoped></style>
