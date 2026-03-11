<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import usePersonalPassword from '@renderer/composables/usePersonalPassword.ts';
import { ToastManager } from '@renderer/utils/ToastManager';
import { assertIsLoggedInOrganization, signTransactions } from '@renderer/utils';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { getTransactionGroupById } from '@renderer/services/organization';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';
import { PublicKeyOwnerCache } from '@renderer/caches/backend/PublicKeyOwnerCache.ts';

/* Props */
const props = defineProps<{
  groupId: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transactionGroupSigned', payload: { groupId: number, signed: boolean}): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const { getPasswordV2 } = usePersonalPassword();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();
const publicKeyOwnerCache = PublicKeyOwnerCache.inject();
const toastManager = ToastManager.inject();

/* State */
const signOnGoing = ref(false);
const isConfirmModalShown = ref(false);

/* Handlers */
const handleClick = () => {
  isConfirmModalShown.value = true;
};

const confirmCallback = () => {
  getPasswordV2(handleSign, {
    subHeading: 'Enter your application password to decrypt your private key',
  });
};

const handleSign = async (personalPassword: string|null) => {
  assertIsLoggedInOrganization(user.selectedOrganization);
  const serverUrl = user.selectedOrganization.serverUrl;

  signOnGoing.value = true;
  try {
    const group = await getTransactionGroupById(serverUrl, props.groupId, false);
    const transactions = group.groupItems.map(item => item.transaction);
    const signed = await signTransactions(
      transactions,
      personalPassword,
      accountByIdCache,
      nodeByIdCache,
      publicKeyOwnerCache,
      toastManager,
    );

    emit('transactionGroupSigned', { groupId: props.groupId, signed });
    if (signed) {
      toastManager.success('Transaction group signed successfully');
    } else {
      toastManager.error('Transaction group not signed');
    }
  } catch {
    toastManager.error('Transaction group not signed');
  } finally {
    signOnGoing.value = false;
  }
};
</script>

<template>
  <AppButton
    v-bind="$attrs"
    :disabled="signOnGoing"
    :loading="signOnGoing"
    loading-text="Sign All"
    color="primary"
    type="button"
    @click.prevent="handleClick"
  >
    Sign All
  </AppButton>

  <AppConfirmModal
    title="Sign all transactions?"
    text="Are you sure you want to sign all the transactions of this group?"
    :callback="confirmCallback"
    v-model:show="isConfirmModalShown"
  />
</template>
