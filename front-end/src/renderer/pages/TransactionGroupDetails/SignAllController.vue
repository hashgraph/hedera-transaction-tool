<script setup lang="ts">
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import usePersonalPassword from '@renderer/composables/usePersonalPassword.ts';
import { assertIsLoggedInOrganization, getErrorMessage, signTransactions } from '@renderer/utils';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { PublicKeyOwnerCache } from '@renderer/caches/backend/PublicKeyOwnerCache.ts';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { TransactionStatus } from '@shared/interfaces';
import { getTransactionGroupById, type IGroup } from '@renderer/services/organization';
import ActionController from './ActionController.vue';

/* Props */
const props = defineProps<{
  groupOrId: IGroup | number | null;
  callback: (groupId: number, signed: boolean) => Promise<void>;
}>();
const activate = defineModel<boolean>('activate', { required: true });

/* Composables */
const { getPasswordV2 } = usePersonalPassword();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();
const publicKeyOwnerCache = PublicKeyOwnerCache.inject();
const toastManager = ToastManager.inject();

/* Stores */
const user = useUserStore();

/* State */
const progressText = ref<string>('Loading group items…');

const handleSignAll = async () => {
  getPasswordV2(performSignAll, {
    subHeading: 'Enter your application password to decrypt your private key',
  });
};

const performSignAll = async (personalPassword: string | null) => {
  if (props.groupOrId !== null) {
    const groupId = typeof props.groupOrId == 'number' ? props.groupOrId : props.groupOrId.id;
    try {
      let group: IGroup;
      if (typeof props.groupOrId === 'number') {
        assertIsLoggedInOrganization(user.selectedOrganization);
        const serverUrl = user.selectedOrganization.serverUrl;
        group = await getTransactionGroupById(serverUrl, props.groupOrId);
      } else {
        group = props.groupOrId;
      }
      let itemsToSign = group.groupItems.map(item => item.transaction) ?? [];
      itemsToSign = itemsToSign.filter(
        item => item.status === TransactionStatus.WAITING_FOR_SIGNATURES,
      );
      progressText.value = `Signing ${itemsToSign.length} transactions`;
      const signed = await signTransactions(
        itemsToSign,
        personalPassword,
        accountByIdCache,
        nodeByIdCache,
        publicKeyOwnerCache,
        toastManager,
      );

      if (signed) {
        toastManager.success('Transactions signed successfully');
      } else {
        toastManager.error('Transactions not signed');
      }
      invokeCallback(groupId, signed);
    } catch {
      toastManager.error('Transactions not signed');
      invokeCallback(groupId, false);
    } finally {
      progressText.value = 'Loading group items…';
    }
  } // else bug
};

const invokeCallback = async (groupId: number, signed: boolean) => {
  try {
    await props.callback(groupId, signed);
  } catch (error) {
    toastManager.error(getErrorMessage(error, 'Transactions not signed'));
  }
};
</script>

<template>
  <ActionController
    v-model:activate="activate"
    :actionCallback="handleSignAll"
    confirm-title="Sign all transactions?"
    confirm-text="Are you sure you want to sign all transactions?"
    progress-icon-name="group"
    progress-title="Sign all transactions"
    :progress-text="progressText"
    data-testid="button-sign-all"
  />
</template>
