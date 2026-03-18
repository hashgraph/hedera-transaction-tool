<script setup lang="ts">
import { ref, watch } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import { getErrorMessage, isLoggedInOrganization, isUserLoggedIn } from '@renderer/utils';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransaction, TransactionStatus } from '@shared/interfaces';
import {
  cancelTransactionGroup,
  getTransactionGroupById,
  type IGroup,
  type IGroupItem,
} from '@renderer/services/organization';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

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
const isConfirmModalShown = ref(false);
const isCancelingOnGoing = ref(false);
const progressText = ref<string>('');

/* Handlers */
const confirmCanceling = async () => {
  isConfirmModalShown.value = false;

  if (props.groupOrId !== null) {
    isCancelingOnGoing.value = true;
    const groupId = typeof props.groupOrId == 'number' ? props.groupOrId : props.groupOrId.id;
    try {
      if (!isLoggedInOrganization(user.selectedOrganization) || !isUserLoggedIn(user.personal)) {
        throw new Error('User is not logged in organization');
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
      await cancelTransactionGroup(
        user.selectedOrganization.serverUrl,
        group.id,
        itemsToCancel,
      );
      toastManager.success('Transactions canceled successfully');
    } catch (error) {
      toastManager.error(getErrorMessage(error, 'Transactions not canceled'));
    } finally {
      await invokeCallback(groupId);
      progressText.value = '';
      isCancelingOnGoing.value = false;
    }
  } else {
    // Bug
    toastManager.error('Unable to cancel transactions because groupOrId is null');
    progressText.value = '';
    isCancelingOnGoing.value = false;
  }

  activate.value = false;
};

const invokeCallback = async (groupId: number) => {
  try {
    await props.callback(groupId);
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Failed to reload group items'));
  }
};

const cancelCanceling = () => {
  isConfirmModalShown.value = false;
  activate.value = false;
};

/* Hooks */
watch(activate, () => {
  if (activate.value) {
    isConfirmModalShown.value = true;
  }
});

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
  <AppConfirmModal
    v-model:show="isConfirmModalShown"
    title="Cancel all transactions?"
    text="Are you sure you want to cancel all transactions?"
    :callback="confirmCanceling"
    :cancel="cancelCanceling"
  />

  <AppModal
    v-model:show="isCancelingOnGoing"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="small-modal"
  >
    <div class="p-4">
      <div class="text-center">
        <AppCustomIcon :name="'group'" style="height: 80px" />
      </div>
      <h3 class="text-center text-title text-bold mt-4">Canceling all transactions</h3>
      <p class="text-center text-small text-secondary mt-4 mb-4">{{ progressText }}</p>
      <p class="text-center text-small text-secondary mt-6 mb-4">
        <span class="spinner-border me-2" role="status" inert></span>{{ ' ' }}
      </p>
    </div>
  </AppModal>
</template>
