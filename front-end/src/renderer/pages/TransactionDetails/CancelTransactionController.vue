<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import { assertIsLoggedInOrganization, getErrorMessage } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull } from '@shared/interfaces';
import { cancelTransaction } from '@renderer/services/organization';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { executeTransactionActionFlow } from '@renderer/pages/TransactionDetails/components/transactionActionFlow.ts';
import type { ActionReport } from '@renderer/components/ActionController/ActionReport';

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
  props.transaction ? `Canceling transaction ${props.transaction.transactionId}` : '',
);

/* Handlers */
const handleCancelTransaction = async (): Promise<ActionReport | null> => {
  assertIsLoggedInOrganization(user.selectedOrganization);

  if (props.transaction !== null) {
    const serverUrl = user.selectedOrganization.serverUrl;
    const transactionId = props.transaction.id;

    await executeTransactionActionFlow({
      execute: async () => {
        await cancelTransaction(serverUrl, transactionId);
      },
      refresh: props.callback,
      onSuccess: () => {
        toastManager.success('Transaction canceled successfully');
      },
      onError: error => {
        toastManager.error(getErrorMessage(error, `Failed to cancel transaction`));
      },
      onRefreshError: refreshError => {
        toastManager.error(getErrorMessage(refreshError, 'Failed to refresh transaction'));
      },
    });
  } else {
    // Bug
    toastManager.error('Unable to cancel: transaction is not available');
  }

  return null;
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleCancelTransaction"
    :progress-text="progressText"
    action-button-text="Cancel transaction"
    cancel-button-text="Do not cancel"
    confirm-text="Are you sure you want to cancel this transaction?"
    confirm-title="Cancel transaction?"
    data-testid="button-cancel-transaction"
    progress-title="Cancel transaction"
  />
</template>
