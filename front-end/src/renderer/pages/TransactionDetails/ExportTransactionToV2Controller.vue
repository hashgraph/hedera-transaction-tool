<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertUserLoggedIn,
  generateTransactionExportFileName,
  generateTransactionV2ExportContent,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull, type TransactionFile } from '@shared/interfaces';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { Transaction } from '@hiero-ledger/sdk';
import { writeTransactionFile } from '@renderer/services/transactionFileService.ts';
import { showSaveDialog } from '@renderer/services/electronUtilsService.ts';
import useNetwork from '@renderer/stores/storeNetwork.ts';
import type { ActionReport } from '@renderer/components/ActionController/ActionReport';

/* Props */
const props = defineProps<{
  transaction: ITransactionFull | null;
  sdkTransaction: Transaction | null;
  callback: () => Promise<void>;
}>();

const activate = defineModel<boolean>('activate', { required: true });

/* Stores */
const user = useUserStore();
const network = useNetwork();

/* Injected */
const toastManager = ToastManager.inject();

/* Computed */
const progressText = computed(() =>
  props.transaction ? `Exporting transaction ${props.transaction.transactionId}` : '',
);

const EXPORT_FORMAT = [
  {
    name: 'TX2 (Tx Tool 2.0)',
    extensions: ['tx2'],
  },
];

/* Handlers */
const handleExportTransaction = async (
  _personalPassword: string | null,
): Promise<ActionReport | null> => {
  assertUserLoggedIn(user.personal);
  if (props.sdkTransaction instanceof Transaction && props.transaction !== null) {
    // Generate the default base name for the file
    const baseName = generateTransactionExportFileName(props.transaction);

    // Show the save dialog to the user, allowing them to choose the file name and location
    const { filePath, canceled } = await showSaveDialog(
      `${baseName || 'transaction'}`,
      'Export transaction',
      'Export',
      EXPORT_FORMAT,
      'Export transaction',
    );

    if (canceled || !filePath) {
      return null;
    }

    // Export TTv2 --> TTv2
    const tx2Content: TransactionFile = generateTransactionV2ExportContent(
      [props.transaction],
      network.network,
    );
    await writeTransactionFile(tx2Content, filePath);

    toastManager.success('Transaction exported successfully');
  } else {
    // Bug
    toastManager.error('Unable to export: transaction is not available');
  }

  return null;
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleExportTransaction"
    :personal-password-required="true"
    :progress-text="progressText"
    progress-title="Export transaction"
  />
</template>
