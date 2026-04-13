<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import { assertIsLoggedInOrganization } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull } from '@shared/interfaces';
import { cancelTransaction } from '@renderer/services/organization';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import {
  type ActionReport,
  makeBugReport,
} from '@renderer/components/ActionController/ActionReport';
import { BackendTransactionCache } from '@renderer/caches/backend/BackendTransactionCache.ts';

/* Props */
const props = defineProps<{
  transaction: ITransactionFull | null;
  callback: () => Promise<void>;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Injected */
const transactionCache = BackendTransactionCache.inject();
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
  const serverUrl = user.selectedOrganization.serverUrl;

  let result: ActionReport | null;
  try {
    if (props.transaction !== null) {
      const transactionId = props.transaction.id;
      await cancelTransaction(serverUrl, transactionId);
      result = null;
      toastManager.success('Transaction canceled successfully');
      } else {
      result = makeBugReport('Cancel', 'Cannot cancel: transaction is not available');
    }
  } finally {
    // 1) we clear transaction cache
    if (props.transaction && user.selectedOrganization) {
      transactionCache.forgetTransaction(props.transaction, serverUrl);
    }
    // 2) we run callback (that will get fresh data from cache)
    await props.callback();
  }

  return result;
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
