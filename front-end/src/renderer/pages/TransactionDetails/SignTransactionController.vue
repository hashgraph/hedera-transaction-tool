<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  collectMissingKeys,
  collectRequiredKeys,
  signItems,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull } from '@shared/interfaces';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { AppCache } from '@renderer/caches/AppCache.ts';
import {
  type ActionReport,
  ActionStatus,
  makeBugReport,
} from '@renderer/components/ActionController/ActionReport.ts';

/* Props */
const props = defineProps<{
  transaction: ITransactionFull | null;
  callback: (signed: boolean) => Promise<void>;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Stores */
const user = useUserStore();

/* Injected */
const appCache = AppCache.inject();
const toastManager = ToastManager.inject();

/* Computed */
const progressText = computed(() =>
  props.transaction ? `Signing transaction ${props.transaction.transactionId}` : '',
);

/* Handlers */
const handleSign = async (personalPassword: string | null): Promise<ActionReport | null> => {
  let result: ActionReport | null = null;
  try {
    if (props.transaction !== null) {
      result = await performSign(props.transaction, personalPassword);
    } else {
      result = makeBugReport('Sign', 'Cannot sign: transaction is undefined');
    }
  } finally {
    // We clear transaction cache
    if (props.transaction && user.selectedOrganization) {
      appCache.backendTransaction.forgetTransaction(props.transaction, user.selectedOrganization.serverUrl);
    }
    await props.callback(result === null);
  }
  return result;
};

const performSign = async (
  transaction: ITransactionFull,
  personalPassword: string | null,
): Promise<ActionReport | null> => {
  let result: ActionReport | null;

  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  const reportTitle = 'Sign Transaction';

  // 1) checks if user has all the required private keys
  const signatureItems = await collectRequiredKeys([transaction], appCache);
  const missingKeys = collectMissingKeys(signatureItems);
  const missingKeyCount = missingKeys.length;
  if (missingKeyCount > 0) {
    // User needs to setup some private keys in Settings
    result = {
      status: ActionStatus.Error,
      title: reportTitle,
      what: missingKeyCount === 1 ? 'Key is missing' : `${missingKeyCount} keys are missing`,
      next:
        missingKeyCount === 1
          ? 'Go to Settings and add the missing key'
          : 'Go to Settings and add the missing keys',
    };
  } else {
    // 2) performs required signing
    const rejectedItems = await signItems(signatureItems, personalPassword);

    if (rejectedItems.length > 0) {
      // Transaction has not been signed
      result = {
        status: ActionStatus.Error,
        title: reportTitle,
        what: 'Failed to sign transaction',
        next: 'Check status of transactions',
      };
    } else {
      // Transaction has been signed
      toastManager.success('Transaction signed successfully');
      result = null;
    }
  }

  return result;
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleSign"
    :personal-password-required="true"
    :progress-text="progressText"
    action-button-text="Sign Transaction"
    cancel-button-text="Do not sign"
    progress-title="Sign Transaction"
  />
</template>
