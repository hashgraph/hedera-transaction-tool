<script setup lang="ts">
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import { getErrorMessage, isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransaction, TransactionStatus } from '@shared/interfaces';
import {
  cancelTransactionGroup,
  getTransactionGroupById,
  type IGroup,
  type IGroupItem,
} from '@renderer/services/organization';
import { getCancelGroupToast } from '@renderer/pages/TransactionGroupDetails/cancelGroupResult.ts';
import ActionController from '@renderer/pages/TransactionGroupDetails/ActionController.vue';

/* Props */
const props = defineProps<{
  groupOrId: IGroup | number | null;
  callback: (groupId: number) => Promise<void>;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Injected */
const toastManager = ToastManager.inject();

/* Stores */
const user = useUserStore();

/* State */
const progressText = ref<string>('');

/* Handlers */
const handleCancelAll = async () => {
  if (props.groupOrId !== null) {
    const groupId = typeof props.groupOrId == 'number' ? props.groupOrId : props.groupOrId.id;
    try {
      if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
        throw new Error('You must be logged in to cancel transactions.');
      }
      let group: IGroup;
      if (typeof props.groupOrId === 'number') {
        const serverUrl = user.selectedOrganization.serverUrl;
        group = await getTransactionGroupById(serverUrl, props.groupOrId);
      } else {
        group = props.groupOrId;
      }
      const itemsToCancel: IGroupItem[] = [];
      for (const groupItem of group.groupItems) {
        if (isTransactionInProgress(groupItem.transaction)) {
          itemsToCancel.push(groupItem);
        }
      }
      progressText.value = `Canceling ${itemsToCancel.length} transactions`;
      const results = await cancelTransactionGroup(
        user.selectedOrganization.serverUrl,
        group.id,
        itemsToCancel,
      );
      const toastResult = getCancelGroupToast(results);

      if (toastResult.kind === 'success') {
        toastManager.success(toastResult.message);
      } else if (toastResult.kind === 'warning') {
        toastManager.warning(toastResult.message);
      } else {
        toastManager.error(toastResult.message);
      }
    } catch (error) {
      toastManager.error(getErrorMessage(error, 'Transactions not canceled'));
    } finally {
      await invokeCallback(groupId);
      progressText.value = '';
    }
  } else {
    // Bug
    toastManager.error('Unable to cancel transactions because groupOrId is null');
    progressText.value = '';
  }
};

const invokeCallback = async (groupId: number) => {
  try {
    await props.callback(groupId);
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to reload group items'));
  }
};

/* Functions */
const isTransactionInProgress = (transaction: ITransaction) => {
  return [
    TransactionStatus.NEW,
    TransactionStatus.WAITING_FOR_EXECUTION,
    TransactionStatus.WAITING_FOR_SIGNATURES,
  ].includes(transaction.status);
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleCancelAll"
    confirm-title="Cancel all transactions?"
    confirm-text="Are you sure you want to cancel all transactions?"
    progress-icon-name="group"
    progress-title="Canceling all transactions"
    :progress-text="progressText"
    data-testid="button-cancel-all"
  />
</template>
