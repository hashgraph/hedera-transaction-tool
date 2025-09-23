<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { showOpenDialog } from '@renderer/services/electronUtilsService.ts';
import { filterForImportV1 } from '@renderer/services/importV1.ts';
import type { V1ImportFilterResult } from '@shared/interfaces';
import TransactionImportModal from '@renderer/components/TransactionImportModal.vue';

/* State */
const emptyFilterResult: V1ImportFilterResult = { candidates: [], ignoredPaths: [] };
const filterResult = ref<V1ImportFilterResult>(emptyFilterResult);
const isImportModalVisible = ref(false);

/* Handlers */
async function handleImport() {
  const result = await showOpenDialog(
    'Import From Transaction Tool V1',
    'Select',
    [{ name: '.zip', extensions: ['zip'] }],
    ['openFile', 'openDirectory', 'multiSelections'],
    'Select ZIP files created by TT V1',
  );

  if (result.canceled) return;

  filterResult.value = await filterForImportV1(result.filePaths);
  isImportModalVisible.value = true
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
  <TransactionImportModal v-model:show="isImportModalVisible" :filter-result="filterResult" />
</template>

<style scoped></style>
