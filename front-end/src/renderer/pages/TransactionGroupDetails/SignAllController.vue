<script lang="ts" setup>
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertIsLoggedInOrganization,
  collectMissingKeys,
  collectRequiredKeys,
  signItems,
} from '@renderer/utils';
import { AppCache } from '@renderer/caches/AppCache.ts';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { getTransactionGroupById, type IGroup } from '@renderer/services/organization';
import { isSignableStatus } from '@renderer/utils/transactionStatusGuards.ts';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import {
  type ActionReport,
  ActionStatus,
  makeBugReport,
} from '@renderer/components/ActionController/ActionReport.ts';

/* Props */
const props = defineProps<{
  groupOrId: IGroup | number | null;
  callback: (groupId: number, signed: boolean) => Promise<void>;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Injected */
const appCache = AppCache.inject();
const toastManager = ToastManager.inject();

/* Stores */
const user = useUserStore();

/* State */
const progressText = ref<string>('');

/* Handlers */
const handleSignAll = async (userPersonalPassword: string | null): Promise<ActionReport | null> => {
  let result: ActionReport | null = null;
  // The caller passes a snapshot taken when signing was initiated, so a server push
  // cannot change what the user is about to sign while the password modal is open.
  const target = props.groupOrId;
  if (target !== null) {
    const groupId = typeof target == 'number' ? target : target.id;
    try {
      result = await performSignAll(target, userPersonalPassword);
    } finally {
      await props.callback(groupId, result === null);
    }
  } else {
    result = makeBugReport('Sign All', 'Failed to sign transactions');
  }
  return result;
};

const performSignAll = async (
  groupOrId: IGroup | number,
  userPersonalPassword: string | null,
): Promise<ActionReport | null> => {
  let result: ActionReport | null;

  progressText.value = '';
  // 1) fetches group items (if needed)
  let group: IGroup;
  if (typeof groupOrId === 'number') {
    assertIsLoggedInOrganization(user.selectedOrganization);
    const serverUrl = user.selectedOrganization.serverUrl;
    progressText.value = 'Loading group items…';
    group = await getTransactionGroupById(serverUrl, groupOrId);
  } else {
    group = groupOrId;
  }

  // 2) collects required keys for signable transactions only
  const signableTransactions = group.groupItems
    .map(item => item.transaction)
    .filter(tx => isSignableStatus(tx.status));
  progressText.value = 'Collecting required keys…';
  const allSignatureItems = await collectRequiredKeys(signableTransactions, appCache);

  // Only process transactions the current user hasn't signed yet
  const signatureItems = allSignatureItems.filter(item => item.publicKeys.length > 0);
  const remainingCount = signatureItems.length;

  if (remainingCount === 0) {
    toastManager.info('All transactions are already signed');
    return null;
  }

  const missingKeys = collectMissingKeys(signatureItems);
  const missingKeyCount = missingKeys.length;
  if (missingKeyCount > 0) {
    // User needs to setup some private keys in Settings
    result = {
      status: ActionStatus.Error,
      title: 'Sign All',
      what: missingKeyCount == 1 ? 'Key is missing' : `${missingKeyCount} keys are missing`,
      next:
        missingKeyCount == 1
          ? 'Go to Settings and add the missing key'
          : 'Go to Settings and add the missing keys',
    };
  } else {
    // 4) performs required signing
    progressText.value = `Signing ${remainingCount} transactions…`;
    const rejectedItems = await signItems(signatureItems, userPersonalPassword);
    const rejectedItemCount = rejectedItems.length;
    if (rejectedItemCount > 0) {
      // Some signatures have not been done
      const signedItemCount = remainingCount - rejectedItemCount;
      if (signedItemCount > 0) {
        // Operation is partial
        result = {
          status: ActionStatus.Error,
          title: 'Sign All',
          what: `${signedItemCount} transactions signed, but ${rejectedItemCount} transactions were not signed`,
          next: 'Check status for unsigned transactions',
        };
      } else {
        // Nothing signed => sign all fully rejected
        result = {
          status: ActionStatus.Error,
          title: 'Sign All',
          what: 'Transactions were not signed',
          next: 'Check status of transactions',
        };
      }
    } else {
      // All remaining unsigned transactions were signed
      const msg =
        remainingCount === 1
          ? 'Remaining 1 transaction was signed'
          : `Remaining ${remainingCount} transactions were signed`;
      toastManager.success(msg);
      result = null;
    }
  }

  return result;
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleSignAll"
    :personal-password-required="true"
    :progress-text="progressText"
    action-button-text="Sign all"
    cancel-button-text="Do not sign"
    data-testid="button-sign-all"
    progress-icon-name="group"
    progress-title="Sign all transactions"
  />
</template>
