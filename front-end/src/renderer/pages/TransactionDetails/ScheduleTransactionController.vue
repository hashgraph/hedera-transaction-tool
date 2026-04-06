<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import { assertIsLoggedInOrganization, getErrorMessage } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull } from '@shared/interfaces';
import { executeTransaction } from '@renderer/services/organization';
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
  props.transaction ? `Scheduling transaction ${props.transaction.transactionId}` : '',
);

/* Handlers */
const handleScheduleTransaction = async (): Promise<ActionReport | null> => {
  assertIsLoggedInOrganization(user.selectedOrganization);

  if (props.transaction !== null) {
    const serverUrl = user.selectedOrganization.serverUrl;
    const transactionId = props.transaction.id;

    await executeTransactionActionFlow({
      execute: async () => {
        await executeTransaction(serverUrl, transactionId);
      },
      refresh: props.callback,
      onSuccess: () => {
        toastManager.success('Transaction scheduled successfully');
      },
      onError: error => {
        toastManager.error(getErrorMessage(error, `Failed to schedule transaction`));
      },
      onRefreshError: refreshError => {
        toastManager.error(getErrorMessage(refreshError, 'Failed to refresh transaction'));
      },
    });
  } else {
    // Bug
    toastManager.error('Unable to schedule: transaction is not available');
  }

  return null;
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleScheduleTransaction"
    :progress-text="progressText"
    action-button-text="Schedule transaction"
    cancel-button-text="Do not schedule"
    confirm-text="Are you sure you want to schedule this transaction?"
    confirm-title="Schedule transaction?"
    data-testid="button-schedule-transaction"
    progress-title="Schedule transaction"
  />
</template>
