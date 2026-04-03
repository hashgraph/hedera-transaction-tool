<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertUserLoggedIn,
  generateTransactionV1ExportContent,
  generateTransactionV2ExportContent,
  getPrivateKey,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull, type TransactionFile } from '@shared/interfaces';
import ActionController from '@renderer/pages/TransactionGroupDetails/ActionController.vue';
import { Transaction } from '@hashgraph/sdk';
import { writeTransactionFile } from '@renderer/services/transactionFileService.ts';
import { decryptPrivateKey } from '@renderer/services/keyPairService.ts';
import { saveFileToPath } from '@renderer/services/electronUtilsService.ts';
import useNetwork from '@renderer/stores/storeNetwork.ts';

/* Props */
const props = defineProps<{
  transaction: ITransactionFull | null;
  sdkTransaction: Transaction | null;
  callback: () => Promise<void>;
  filePath: string;
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
const handleExportTransaction = async (personalPassword: string | null) => {
  assertUserLoggedIn(user.personal);
  if (props.sdkTransaction instanceof Transaction && props.transaction !== null) {
    const ext = props.filePath.split('.').pop();
    if (ext === 'tx2') {
      // Export TTv2 --> TTv2
      const tx2Content: TransactionFile = generateTransactionV2ExportContent(
        [props.transaction],
        network.network,
      );
      await writeTransactionFile(tx2Content, props.filePath);

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

      await saveFileToPath(transactionBytes, props.filePath);
      const txtFilePath = props.filePath.replace(/\.[^/.]+$/, '.txt');
      await saveFileToPath(jsonContent, txtFilePath);

      toastManager.success('Transaction exported successfully');
    }
  } else {
    // Bug
    toastManager.error('Unable to export: transaction is not available');
  }
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleExportTransaction"
    :personal-password-required="true"
    :progress-text="progressText"
    progress-icon-name="questionMark"
    progress-title="Exporting transaction"
  />
</template>
