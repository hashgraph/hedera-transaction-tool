<script lang="ts" setup>
import { computed, ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertIsLoggedInOrganization,
  getErrorMessage,
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
  hexToUint8Array,
  isUserLoggedIn,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import {
  getTransactionGroupById,
  getUserShouldApprove,
  type IGroup,
  sendApproverChoice,
} from '@renderer/services/organization';
import ActionController from '@renderer/pages/TransactionGroupDetails/ActionController.vue';
import { decryptPrivateKey } from '@renderer/services/keyPairService.ts';
import { Transaction } from '@hashgraph/sdk';

/* Props */
const props = defineProps<{
  groupOrId: IGroup | number | null;
  callback: (groupId: number) => Promise<void>;
  approved?: boolean;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Injected */
const toastManager = ToastManager.inject();

/* Stores */
const user = useUserStore();

/* State */
const progressText = ref<string>('Loading group items…');

/* Computed */
const action = computed(() => (props.approved ? 'approve' : 'reject'));

const actionButtonText = computed(() => (props.approved ? 'Approve all' : 'Reject all'));

const progressTitle = computed(() =>
  props.approved ? 'Approve all transactions' : 'Reject all transactions',
);

const confirmTitle = computed(() =>
  props.approved ? 'Approve all transactions?' : 'Reject all transactions?',
);

const confirmText = computed(() => `Are you sure you want to ${action.value} all transactions?`);

/* Handlers */
const handleApproveAll = async (personalPassword: string | null) => {
  if (!isUserLoggedIn(user.personal)) {
    toastManager.error(`You must be logged in to ${action.value} transactions.`);
    return;
  }
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

      progressText.value = `${props.approved ? 'Approving' : 'Rejecting'} ${group.groupItems.length} transactions`;

      const publicKey = user.selectedOrganization.userKeys[0].publicKey;
      const privateKeyRaw = await decryptPrivateKey(user.personal.id, personalPassword, publicKey);
      const privateKey = getPrivateKey(publicKey, privateKeyRaw);

      for (const item of group.groupItems) {
        if (await getUserShouldApprove(user.selectedOrganization.serverUrl, item.transaction.id)) {
          const transactionBytes = hexToUint8Array(item.transaction.transactionBytes);
          const transaction = Transaction.fromBytes(transactionBytes);
          const signature = getTransactionBodySignatureWithoutNodeAccountId(
            privateKey,
            transaction,
          );

          await sendApproverChoice(
            user.selectedOrganization.serverUrl,
            item.transaction.id,
            user.selectedOrganization.userKeys[0].id,
            signature,
            props.approved,
          );
        }
      }
      toastManager.success(`Transactions ${props.approved ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      toastManager.error(getErrorMessage(error, `Failed to ${action.value} transactions`));
    } finally {
      await invokeCallback(groupId);
      progressText.value = 'Loading group items…';
    }
  } else {
    // Bug
    toastManager.error(`Unable to ${action.value} transactions: group is not available`);
  }
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
    :action-button-text="actionButtonText"
    :actionCallback="handleApproveAll"
    :cancel-button-text="`Do not ${action}`"
    :confirm-text="confirmText"
    :confirm-title="confirmTitle"
    :personal-password-required="true"
    :progress-text="progressText"
    :progress-title="progressTitle"
    data-testid="button-approve-all"
  />
</template>
