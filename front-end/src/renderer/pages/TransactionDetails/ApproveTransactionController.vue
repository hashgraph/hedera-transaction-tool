<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  getErrorMessage,
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import ActionController from '@renderer/pages/TransactionGroupDetails/ActionController.vue';
import { decryptPrivateKey } from '@renderer/services/keyPairService.ts';
import { sendApproverChoice } from '@renderer/services/organization';
import { Transaction } from '@hashgraph/sdk';
import type { ITransactionFull } from '@shared/interfaces';

/* Props */
const props = defineProps<{
  transaction: ITransactionFull | null;
  sdkTransaction: Transaction | null;
  callback: () => Promise<void>;
  approved?: boolean;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Stores */
const user = useUserStore();

/* Injected */
const toastManager = ToastManager.inject();

/* Computed */
const action = computed(() => (props.approved ? 'approve' : 'reject'));

const actionButtonText = computed(() =>
  props.approved ? 'Approve transaction' : 'Reject transaction',
);

const progressTitle = computed(() =>
  props.approved ? 'Approve transaction' : 'Reject transaction',
);

const progressText = computed(() =>
  props.transaction ? `${progressTitle.value} ${props.transaction.transactionId}` : '',
);

const confirmTitle = computed(() => (props.approved ? undefined : 'Reject transaction?'));

const confirmText = computed(() =>
  props.approved ? undefined : 'Are you sure you want to reject this transaction?',
);

/* Handlers */
const handleApproveTransaction = async (personalPassword: string | null) => {
  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  if (props.sdkTransaction instanceof Transaction && props.transaction !== null) {
    try {
      const orgKey = user.selectedOrganization.userKeys.filter(k => k.mnemonicHash)[0];
      const privateKeyRaw = await decryptPrivateKey(
        user.personal.id,
        personalPassword,
        orgKey.publicKey,
      );

      const privateKey = getPrivateKey(orgKey.publicKey, privateKeyRaw);

      const signature = getTransactionBodySignatureWithoutNodeAccountId(
        privateKey,
        props.sdkTransaction,
      );

      await sendApproverChoice(
        user.selectedOrganization.serverUrl,
        props.transaction.id,
        orgKey.id,
        signature,
        props.approved,
      );
      await props.callback();
      toastManager.success(`Transaction ${props.approved ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      toastManager.error(getErrorMessage(error, `Failed to ${action.value} transaction`));
    }
  } else {
    // Bug
    toastManager.error(
      `Unable to ${action.value}: transaction is not available`,
    );
  }
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :action-button-text="actionButtonText"
    :actionCallback="handleApproveTransaction"
    :cancel-button-text="`Do not ${action}`"
    :confirm-text="confirmText"
    :confirm-title="confirmTitle"
    :personal-password-required="true"
    :progress-text="progressText"
    :progress-title="progressTitle"
    data-testid="button-approve-transaction"
  />
</template>
