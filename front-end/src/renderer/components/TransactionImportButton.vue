<script setup lang="ts">
import AppButton from '@renderer/components/ui/AppButton.vue';
import { showOpenDialog } from '@renderer/services/electronUtilsService.ts';

/* Handlers */
async function handleImport() {
  const result = await showOpenDialog(
    'Select Signature Files',
    'Select',
    [{ name: '.csv, .zip or a folder ', extensions: ['csv', 'zip'] }],
    ['openFile', 'openDirectory', 'multiSelections'],
    'Import Signature Files',
  );

  if (result.canceled) return;

  console.log('result=' + JSON.stringify(result, null, 2));
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
</template>

<style scoped></style>
