<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertUserLoggedIn,
  generateTransactionExportFileName,
  generateTransactionV1ExportContent,
  generateTransactionV2ExportContent,
  getLastExportExtension,
  getPrivateKey,
  setLastExportExtension,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull, type TransactionFile } from '@shared/interfaces';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { Transaction } from '@hashgraph/sdk';
import { writeTransactionFile } from '@renderer/services/transactionFileService.ts';
import { decryptPrivateKey } from '@renderer/services/keyPairService.ts';
import { saveFileToPath, showSaveDialog } from '@renderer/services/electronUtilsService.ts';
import useNetwork from '@renderer/stores/storeNetwork.ts';
import type { ActionReport } from "@renderer/components/ActionController/ActionReport";

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

const EXPORT_FORMATS = [
  {
    name: 'TX2 (Tx Tool 2.0)',
    value: 'tt2',
    extensions: ['tx2'],
    enabled: true, // Set to false to hide/remove in the future
  },
  {
    name: 'TX (Tx Tool 1.0)',
    value: 'tt1',
    extensions: ['tx'],
    enabled: true, // Set to false to hide/remove
  },
];

/* Handlers */
const handleExportTransaction = async (personalPassword: string | null): Promise<ActionReport | null> => {
  assertUserLoggedIn(user.personal);
  if (props.sdkTransaction instanceof Transaction && props.transaction !== null) {
    // Load the last export format the user selected, if applicable
    const enabledFormats = EXPORT_FORMATS.filter(f => f.enabled);
    const defaultFormat =
      getLastExportExtension() || (enabledFormats[0] || EXPORT_FORMATS[0]).extensions[0];

    // Move the default format to the top
    enabledFormats.sort((a /*, b*/) => (a.extensions[0] === defaultFormat ? -1 : 1));

    // Generate the default base name for the file
    const baseName = generateTransactionExportFileName(props.transaction);

    // Show the save dialog to the user, allowing them to choose the file name and location
    const { filePath, canceled } = await showSaveDialog(
      `${baseName || 'transaction'}`,
      'Export transaction',
      'Export',
      enabledFormats,
      'Export transaction',
    );

    if (canceled || !filePath) {
      return null;
    }

    // Save selected format to local storage
    const ext = filePath.split('.').pop();
    if (!ext || !EXPORT_FORMATS.find(f => f.extensions[0] === ext)) {
      throw new Error(`Unsupported file extension: ${ext}`);
    }
    setLastExportExtension(ext);

    if (ext === 'tx2') {
      // Export TTv2 --> TTv2
      const tx2Content: TransactionFile = generateTransactionV2ExportContent(
        [props.transaction],
        network.network,
      );
      await writeTransactionFile(tx2Content, filePath);

      toastManager.success('Transaction exported successfully');
    } else if (ext === 'tx') {
      // Export TTv2 --> TTv1
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

      await saveFileToPath(transactionBytes, filePath);
      const txtFilePath = filePath.replace(/\.[^/.]+$/, '.txt');
      await saveFileToPath(jsonContent, txtFilePath);

      toastManager.success('Transaction exported successfully');
    }
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
