<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  getPrivateKey,
  getTransactionBodySignatureWithoutNodeAccountId,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { decryptPrivateKey } from '@renderer/services/keyPairService.ts';
import { sendApproverChoice } from '@renderer/services/organization';
import { Transaction } from '@hiero-ledger/sdk';
import type { ITransactionFull } from '@shared/interfaces';
import {
  type ActionReport,
  makeBugReport,
} from '@renderer/components/ActionController/ActionReport';
import { BackendTransactionCache } from '@renderer/caches/backend/BackendTransactionCache.ts';

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
const transactionCache = BackendTransactionCache.inject();
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
const handleApproveTransaction = async (
  personalPassword: string | null,
): Promise<ActionReport | null> => {
  let result: ActionReport | null = null;
  try {
    if (props.sdkTransaction instanceof Transaction && props.transaction !== null) {
      result = await performApprove(props.transaction, props.sdkTransaction, personalPassword);
    } else {
      result = makeBugReport('Approve', 'Cannot approve: transaction is not available');
    }
  } finally {
    // 1) we clear transaction cache
    if (props.transaction && user.selectedOrganization) {
      transactionCache.forgetTransaction(props.transaction, user.selectedOrganization.serverUrl);
    }
    // 2) we run callback (that will get fresh data from cache)
    await props.callback();
  }

  return result;
};

const performApprove = async (
  transaction: ITransactionFull,
  sdkTransaction: Transaction,
  personalPassword: string | null,
): Promise<ActionReport | null> => {
  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  const orgKey = user.selectedOrganization.userKeys.filter(k => k.mnemonicHash)[0];
  const privateKeyRaw = await decryptPrivateKey(
    user.personal.id,
    personalPassword,
    orgKey.publicKey,
  );

  const privateKey = getPrivateKey(orgKey.publicKey, privateKeyRaw);

  const signature = getTransactionBodySignatureWithoutNodeAccountId(privateKey, sdkTransaction);

  await sendApproverChoice(
    user.selectedOrganization.serverUrl,
    transaction.id,
    orgKey.id,
    signature,
    props.approved,
  );
  toastManager.success(`Transaction ${props.approved ? 'approved' : 'rejected'} successfully`);

  return null;
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
