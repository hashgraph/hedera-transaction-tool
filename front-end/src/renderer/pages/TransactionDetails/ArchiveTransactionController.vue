<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import { assertIsLoggedInOrganization, getErrorMessage } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull } from '@shared/interfaces';
import { archiveTransaction } from '@renderer/services/organization';
import ActionController from '@renderer/pages/TransactionGroupDetails/ActionController.vue';
import { executeTransactionActionFlow } from '@renderer/pages/TransactionDetails/components/transactionActionFlow.ts';

/* Props */
const props = defineProps<{
  transaction: ITransactionFull | null;
  callback: () => Promise<void>;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Injected */
const toastManager = ToastManager.inject();

/* Stores */
const user = useUserStore();

/* Computed */
const progressText = computed(() =>
  props.transaction ? `Archiving transaction ${props.transaction.transactionId}` : '',
);

/* Handlers */
const handleArchiveTransaction = async () => {
  assertIsLoggedInOrganization(user.selectedOrganization);

  if (props.transaction !== null) {
    const serverUrl = user.selectedOrganization.serverUrl;
    const transactionId = props.transaction.id;

    await executeTransactionActionFlow({
      execute: async () => {
        await archiveTransaction(serverUrl, transactionId);
      },
      refresh: props.callback,
      onSuccess: () => {
        toastManager.success('Transaction archived successfully');
      },
      onError: error => {
        toastManager.error(getErrorMessage(error, `Failed to archive transaction`));
      },
      onRefreshError: refreshError => {
        toastManager.error(getErrorMessage(refreshError, 'Failed to refresh transaction'));
      },
    });
  } else {
    // Bug
    toastManager.error('Unable to archive: transaction is not available');
  }
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleArchiveTransaction"
    :progress-text="progressText"
    action-button-text="Archive transaction"
    cancel-button-text="Do not archive"
    confirm-text="Are you sure you want to archive this transaction?"
    confirm-title="Archive transaction?"
    data-testid="button-archive-transaction"
    progress-title="Archiving transaction"
  />
</template>
