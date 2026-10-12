<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertUserLoggedIn,
  generateTransactionExportFileName,
  generateTransactionV1ExportContent,
  getPrivateKey,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull } from '@shared/interfaces';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { Transaction } from '@hiero-ledger/sdk';
import { decryptPrivateKey } from '@renderer/services/keyPairService.ts';
import { exportFilesWithDialog } from '@renderer/services/electronUtilsService.ts';
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

/* Injected */
const toastManager = ToastManager.inject();

/* Computed */
const progressText = computed(() =>
  props.transaction ? `Exporting transaction ${props.transaction.transactionId}` : '',
);

const EXPORT_FORMAT = [
  {
    name: 'TX (Tx Tool 1.0)',
    extensions: ['tx'],
  },
];

/* Handlers */
const handleExportTransaction = async (
  personalPassword: string | null,
): Promise<ActionReport | null> => {
  assertUserLoggedIn(user.personal);
  if (props.sdkTransaction instanceof Transaction && props.transaction !== null) {
    // Generate the default base name for the file
    const baseName = generateTransactionExportFileName(props.transaction);

    if (user.publicKeys.length === 0) {
      throw new Error(
        'Exporting in the .tx format requires a signature. User must have at least one key pair to sign the transaction.',
      );
    }
    const publicKey = user.publicKeys[0]; // get the first key pair's public key
    const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, publicKey);
    const privateKey = getPrivateKey(publicKey, privateKeyRaw);

    const { transactionBytes, jsonContent } = await generateTransactionV1ExportContent(
      props.transaction,
      privateKey,
    );

    // Show the save dialog to the user and export to TTv1 format:
    //  - <chosen-file-path>.tx: will contain the transaction bytes
    //  - <chosen-file-path>.txt: will contain the transaction description JSON content
    const exported = await exportFilesWithDialog(
      [{ data: transactionBytes, extension: '.tx' }, { data: jsonContent, extension: '.txt' }],
      `${baseName || 'transaction'}.tx`,
      'Export transaction',
      'Export',
      EXPORT_FORMAT,
      'Export transaction',
    );
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
