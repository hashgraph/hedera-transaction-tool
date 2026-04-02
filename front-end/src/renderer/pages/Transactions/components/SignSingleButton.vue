<script setup lang="ts">
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import usePersonalPassword from '@renderer/composables/usePersonalPassword.ts';
import { ToastManager } from '@renderer/utils/ToastManager';
import { assertIsLoggedInOrganization, signTransactions } from '@renderer/utils';
import { getTransactionById } from '@renderer/services/organization';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { PublicKeyOwnerCache } from '@renderer/caches/backend/PublicKeyOwnerCache.ts';

/* Props */
const props = defineProps<{
  transactionId: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transactionSigned', payload: { transactionId: number, signed: boolean}): void;
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

/* Handlers */
const handleClick = () => {
  getPasswordV2(handleSign, {
    subHeading: 'Enter your application password to decrypt your private key',
  });
};

const handleSign = async (personalPassword: string|null) => {
  assertIsLoggedInOrganization(user.selectedOrganization);

  const transaction = await getTransactionById(
    user.selectedOrganization.serverUrl,
    props.transactionId,
  );

  try {
    signOnGoing.value = true;

    const itemsToSign = [transaction];
    const signed = await signTransactions(
      itemsToSign,
      personalPassword,
      accountByIdCache,
      nodeByIdCache,
      publicKeyOwnerCache,
      toastManager,
    );

    emit('transactionSigned', { transactionId: props.transactionId, signed });
    if (signed) {
      toastManager.success('Transaction signed successfully');
    } else {
      toastManager.error('Transaction not signed');
    }
  } catch {
    toastManager.error('Transaction not signed');
  } finally {
    signOnGoing.value = false;
  }
};
</script>

<template>
  <AppButton
    :disabled="signOnGoing"
    :loading="signOnGoing"
    loading-text="Sign"
    color="primary"
    type="button"
    @click.prevent="handleClick"
  >
    Sign
  </AppButton>
</template>
