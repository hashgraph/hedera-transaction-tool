<script lang="ts" setup>
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  generateTransactionExportFileName,
  generateTransactionV1ExportContent,
  getErrorMessage,
  getPrivateKey,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import {
  getTransactionGroupById,
  type IGroup,
  type IGroupItem,
} from '@renderer/services/organization';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { decryptPrivateKey } from '@renderer/services/keyPairService.ts';
import { saveFileToPath, showSaveDialog } from '@renderer/services/electronUtilsService.ts';
import JSZip from 'jszip';
import type { ActionReport } from '@renderer/components/ActionController/ActionReport';
import { AppCache } from '@renderer/caches/AppCache.ts';

/* Props */
const props = defineProps<{
  groupOrId: IGroup | number | null;
  callback: (groupId: number) => Promise<void>;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Injected */
const toastManager = ToastManager.inject();
const transactionCache = AppCache.inject().backendTransaction;

/* Stores */
const user = useUserStore();

/* State */
const progressText = ref<string>('');

/* Handlers */
const handleExportAll = async (personalPassword: string | null): Promise<ActionReport | null> => {
  // This currently only exports to TTv1 format
  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  if (props.groupOrId !== null) {
    const groupId = typeof props.groupOrId == 'number' ? props.groupOrId : props.groupOrId.id;
    try {
      let group: IGroup;
      if (typeof props.groupOrId === 'number') {
        const serverUrl = user.selectedOrganization.serverUrl;
        group = await getTransactionGroupById(serverUrl, props.groupOrId);
      } else {
        group = props.groupOrId;
      }

      if (user.publicKeys.length === 0) {
        toastManager.error(
          'Exporting in the .tx format requires a signature. User must have at least one key pair to sign the transaction.',
        );
        return null;
      }
      progressText.value = `Exporting ${group.groupItems.length} transactions`;

      const publicKey = user.publicKeys[0]; // get the first key pair's public key

      const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, publicKey);
      const privateKey = getPrivateKey(publicKey, privateKeyRaw);

      const zip = new JSZip(); // Prepare a new ZIP archive

      for (const item of group.groupItems as IGroupItem[]) {
        const orgTransaction = await transactionCache.lookup(
          item.transactionId,
          user.selectedOrganization.serverUrl,
        );

        const baseName = generateTransactionExportFileName(orgTransaction);

        const { transactionBytes, jsonContent } = await generateTransactionV1ExportContent(
          orgTransaction,
          privateKey,
          group.description,
        );

        zip.file(`${baseName}.tx`, transactionBytes); // Add .tx file content to ZIP
        zip.file(`${baseName}.txt`, jsonContent); // Add .txt  file content to ZIP
      }
      // Generate the ZIP file in-memory as a Uint8Array
      const zipContent = await zip.generateAsync({ type: 'uint8array' });

      // Generate the ZIP file name
      const zipBaseName = `${group.description.substring(0, 25) || 'transaction-group'}`;

      // Save the ZIP file to disk
      const { filePath, canceled } = await showSaveDialog(
        `${zipBaseName}.zip`,
        'Export transaction group',
        'Export',
        [{ name: 'Transaction Tool v1 ZIP archive', extensions: ['zip'] }],
        'Select the file to export the transaction group to:',
      );
      if (canceled || !filePath) {
        return null;
      }

      // write the zip file to disk
      await saveFileToPath(zipContent, filePath);

      toastManager.success('Transaction exported successfully');
    } catch {
      toastManager.error('Transactions not exported');
    } finally {
      await invokeCallback(groupId);
    }
  } else {
    // Bug
    toastManager.error('Unable to export transactions: group is not available');
  }

  return null;
};

const invokeCallback = async (groupId: number) => {
  try {
    await props.callback(groupId);
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to reload group items'));
  }
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleExportAll"
    :personal-password-required="true"
    :progress-text="progressText"
    progress-icon-name="group"
    progress-title="Export all transactions"
  />
</template>
