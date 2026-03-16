<script setup lang="ts">
import { ref, watch } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import usePersonalPassword from '@renderer/composables/usePersonalPassword.ts';
import { assertIsLoggedInOrganization, getErrorMessage, signTransactions } from '@renderer/utils';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { PublicKeyOwnerCache } from '@renderer/caches/backend/PublicKeyOwnerCache.ts';
import { ToastManager } from '@renderer/utils/ToastManager.ts';
import { TransactionStatus } from '@shared/interfaces';
import { getTransactionGroupById, type IGroup } from '@renderer/services/organization';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppCustomIcon from '@renderer/components/ui/AppCustomIcon.vue';

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
const isConfirmModalShown = ref(false);
const isSigningOnGoing = ref(false);
const progressText = ref<string>('Loading group items…');

/* Handlers */
const confirmSigning = () => {
  isConfirmModalShown.value = false;
  activate.value = false;

  getPasswordV2(performSignAll, {
    subHeading: 'Enter your application password to decrypt your private key',
  });
};

const cancelSigning = () => {
  isConfirmModalShown.value = false;
  activate.value = false;
};

const performSignAll = async (personalPassword: string | null) => {
  //  if (passwordModalOpened(personalPassword)) return;

  if (props.groupOrId !== null) {
    isSigningOnGoing.value = true;
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
      isSigningOnGoing.value = false;
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

/* Hooks */
watch(activate, () => {
  if (activate.value) {
    isConfirmModalShown.value = true;
  }
});
</script>

<template>
  <AppConfirmModal
    v-model:show="isConfirmModalShown"
    title="Sign all transactions?"
    text="Are you sure you want to sign all transactions?"
    :callback="confirmSigning"
    :cancel="cancelSigning"
  />

  <AppModal
    :show="isSigningOnGoing"
    :close-on-click-outside="false"
    :close-on-escape="false"
    class="small-modal"
  >
    <div class="p-4">
      <div class="text-center">
        <AppCustomIcon :name="'group'" style="height: 80px" />
      </div>
      <h5 class="text-center p-4">Signing All</h5>
      <p class="text-center text-small text-secondary mt-4 mb-4">{{ progressText }}</p>
      <p class="text-center text-small text-secondary mt-6 mb-4">
        <span class="spinner-border spinner-border me-2" role="status" inert></span>{{ ' ' }}
      </p>
    </div>
  </AppModal>
</template>
