<script lang="ts" setup>
import { computed } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  getErrorMessage,
  signTransactions,
} from '@renderer/utils';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { type ITransactionFull } from '@shared/interfaces';
import ActionController from '@renderer/components/ActionController/ActionController.vue';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { PublicKeyOwnerCache } from '@renderer/caches/backend/PublicKeyOwnerCache.ts';
import useNextTransactionV2 from '@renderer/stores/storeNextTransactionV2.ts';
import { useRouter } from 'vue-router';
import type { ActionReport } from '@renderer/components/ActionController/ActionReport.ts';

/* Props */
const props = defineProps<{
  transaction: ITransactionFull | null;
  callback: (signed: boolean) => Promise<void>;
  goNext?: boolean;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Stores */
const user = useUserStore();
const nextTransaction = useNextTransactionV2();

/* Composables */
const router = useRouter();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();
const publicKeyOwnerCache = PublicKeyOwnerCache.inject();
const toastManager = ToastManager.inject();

/* Computed */
const progressText = computed(() =>
  props.transaction ? `Signing transaction ${props.transaction.transactionId}` : '',
);

/* Handlers */
const handleSignTransaction = async (personalPassword: string | null): Promise<ActionReport | null> => {
  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  if (props.transaction !== null) {
    try {
      const signed = await signTransactions(
        [props.transaction],
        personalPassword,
        accountByIdCache,
        nodeByIdCache,
        publicKeyOwnerCache,
        toastManager,
      );
      await props.callback(signed);

      if (signed) {
        toastManager.success('Transaction signed successfully');
        if (props.goNext) {
          if (nextTransaction.hasNext) {
            await nextTransaction.routeToNext(router);
          } else {
            await nextTransaction.routeUp(router);
          }
        }
      } else {
        toastManager.error('Failed to sign transaction');
      }
    } catch (error) {
      toastManager.error(getErrorMessage(error, 'Failed to sign transaction'));
    }
  } else {
    // Bug
    toastManager.error('Unable to sign: transaction is not available');
  }

  return null;
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleSignTransaction"
    :personal-password-required="true"
    :progress-text="progressText"
    action-button-text="Sign Transaction"
    cancel-button-text="Do not sign"
    progress-title="Sign Transaction"
  />
</template>
