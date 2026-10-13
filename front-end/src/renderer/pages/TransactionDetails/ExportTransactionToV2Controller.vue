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
import { exportTransactionFile } from '@renderer/services/transactionFileService.ts';
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

/* Handlers */
const handleExportTransaction = async (
  _personalPassword: string | null,
): Promise<ActionReport | null> => {
  assertUserLoggedIn(user.personal);
  if (props.sdkTransaction instanceof Transaction && props.transaction !== null) {
    // Generate the default base name for the file
    const baseName = generateTransactionExportFileName(props.transaction);

    // Export TTv2 --> TTv2
    const tx2Content: TransactionFile = generateTransactionV2ExportContent(
      [props.transaction],
      network.network,
    );
    const exported = await exportTransactionFile(tx2Content, `${baseName || 'transaction'}.tx2`);
    if (!exported) return null;

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
