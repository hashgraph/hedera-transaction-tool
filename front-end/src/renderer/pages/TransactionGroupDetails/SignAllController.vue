<script lang="ts" setup>
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertIsLoggedInOrganization,
  collectMissingKeys,
  collectRequiredKeys,
  signItems,
} from '@renderer/utils';
import { AppCache } from '@renderer/caches/AppCache';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { TransactionStatus } from '@shared/interfaces';
import { getTransactionGroupById, type IGroup } from '@renderer/services/organization';
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
  let result: ActionReport | null;
  if (props.groupOrId !== null) {
    const groupId = typeof props.groupOrId == 'number' ? props.groupOrId : props.groupOrId.id;
    try {
      result = await performSignAll(userPersonalPassword);
    } finally {
      await props.callback(groupId, true);
    }
  } else {
    result = makeBugReport('Sign All', 'Failed to sign transactions');
  }
  return result;
};

const performSignAll = async (
  userPersonalPassword: string | null,
): Promise<ActionReport | null> => {
  let result: ActionReport | null;

  progressText.value = '';
  if (props.groupOrId !== null) {
    // 1) fetches group items (if needed)
    let group: IGroup;
    if (typeof props.groupOrId === 'number') {
      assertIsLoggedInOrganization(user.selectedOrganization);
      const serverUrl = user.selectedOrganization.serverUrl;
      progressText.value = 'Loading group items…';
      group = await getTransactionGroupById(serverUrl, props.groupOrId);
    } else {
      group = props.groupOrId;
    }

    // 2) filters group items waiting for signatures
    let itemsToSign = group.groupItems.map(item => item.transaction) ?? [];
    itemsToSign = itemsToSign.filter(
      item => item.status === TransactionStatus.WAITING_FOR_SIGNATURES,
    );

    // 3) checks if user has all the required private keys
    progressText.value = 'Collecting required keys…';
    const signatureItems = await collectRequiredKeys(
      itemsToSign,
      appCache,
    );
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
      progressText.value = `Signing ${itemsToSign.length} transactions…`;
      const rejectedItems = await signItems(signatureItems, userPersonalPassword);
      const rejectedItemCount = rejectedItems.length;
      if (rejectedItemCount > 0) {
        // Some signatures have not been done
        const signedItemCount = signatureItems.length - rejectedItemCount;
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
        // All signatures have been done successfully
        toastManager.success('Transactions signed successfully');
        result = null;
      }
    }
  } else {
    result = makeBugReport('Sign All', 'Failed to sign transactions');
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
    confirm-text="Are you sure you want to sign all transactions?"
    confirm-title="Sign all transactions?"
    data-testid="button-sign-all"
    progress-icon-name="group"
    progress-title="Sign all transactions"
  />
</template>
