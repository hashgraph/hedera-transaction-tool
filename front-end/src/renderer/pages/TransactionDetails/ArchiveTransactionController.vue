<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import { assertIsLoggedInOrganization } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull } from '@shared/interfaces';
import { archiveTransaction } from '@renderer/services/organization';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import {
  type ActionReport,
  ActionStatus,
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
  props.transaction ? `Archiving transaction ${props.transaction.transactionId}` : '',
);

/* Handlers */
const handleArchiveTransaction = async (): Promise<ActionReport | null> => {
  assertIsLoggedInOrganization(user.selectedOrganization);
  const serverUrl = user.selectedOrganization.serverUrl;

  let result: ActionReport | null;
  try {
    if (props.transaction !== null) {
      const transactionId = props.transaction.id;
      const done = await archiveTransaction(serverUrl, transactionId);
      if (done) {
        result = null;
        toastManager.success('Transaction archived successfully');
      } else {
        result = {
          status: ActionStatus.Warning,
          title: 'Archive Transaction',
          what: 'Failed to archive transaction',
          next: 'Check status of transactions',
        };
      }
    } else {
      result = makeBugReport('Archive', 'Cannot archive: transaction is not available');
    }
  } finally {
    // 1) we clear transaction cache
    if (props.transaction) {
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
    :actionCallback="handleArchiveTransaction"
    :progress-text="progressText"
    action-button-text="Archive transaction"
    cancel-button-text="Do not archive"
    confirm-text="Are you sure you want to archive this transaction?"
    confirm-title="Archive transaction?"
    data-testid="button-archive-transaction"
    progress-title="Archive transaction"
  />
</template>
