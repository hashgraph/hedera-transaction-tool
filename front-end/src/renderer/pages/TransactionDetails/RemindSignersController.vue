<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import { assertIsLoggedInOrganization, getErrorMessage } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull } from '@shared/interfaces';
import { remindSigners } from '@renderer/services/organization';
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
  props.transaction
    ? `Sending reminders to signers of transaction ${props.transaction.transactionId}`
    : '',
);

/* Handlers */
const handleRemindSigners = async () => {
  assertIsLoggedInOrganization(user.selectedOrganization);

  if (props.transaction !== null) {
    const serverUrl = user.selectedOrganization.serverUrl;
    const transactionId = props.transaction.id;

    await executeTransactionActionFlow({
      execute: async () => {
        await remindSigners(serverUrl, transactionId);
      },
      refresh: props.callback,
      onSuccess: () => {
        toastManager.success('Reminders successfully sent to signers');
      },
      onError: error => {
        toastManager.error(getErrorMessage(error, `Failed to send send reminders to signers`));
      },
      onRefreshError: refreshError => {
        toastManager.error(getErrorMessage(refreshError, 'Failed to refresh transaction'));
      },
    });
  } else {
    // Bug
    toastManager.error('Unable to send reminders: transaction is not available');
  }
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleRemindSigners"
    :progress-text="progressText"
    action-button-text="Send reminders"
    cancel-button-text="Do not send"
    confirm-text="Send reminders to all signers of this transaction who have not yet signed?"
    confirm-title="Remind Signers?"
    data-testid="button-remind-signers"
    progress-icon-name="questionMark"
    progress-title="Sending reminders"
  />
</template>
