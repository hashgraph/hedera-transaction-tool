<script setup lang="ts">
import { useToast } from 'vue-toast-notification';
import useUserStore from '@renderer/stores/storeUser.ts';
import AppButton from '@renderer/components/ui/AppButton.vue';
import type { ITransactionFull } from '@shared/interfaces';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { PublicKeyOwnerCache } from '@renderer/caches/backend/PublicKeyOwnerCache.ts';
import { assertIsLoggedInOrganization, signTransactions } from '@renderer/utils';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';
import { getTransactionById } from '@renderer/services/organization';
import usePersonalPassword from '@renderer/composables/usePersonalPassword.ts';
import { ref } from 'vue';

/* Props */
const props = defineProps<{
  transactionId: number;
  signingEnabled: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transactionSigned', payload: { transaction: ITransactionFull; signed: boolean }): void;
}>();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();
const publicKeyOwnerCache = PublicKeyOwnerCache.inject();

/* Composables */
const toast = useToast();
const { getPasswordV2 } = usePersonalPassword();

/* Stores */
const user = useUserStore();

/* State */
const signOnGoing = ref(false);

/* Handlers */
const handleClick = () => {
  getPasswordV2(handleSign, {
    subHeading: 'Enter your application password to decrypt your private key',
  });
};

const handleSign = async (personalPassword: string | null) => {
  assertIsLoggedInOrganization(user.selectedOrganization);

  try {
    signOnGoing.value = true;

    const transaction = await getTransactionById(
      user.selectedOrganization.serverUrl,
      props.transactionId,
    );
    const itemsToSign = [transaction];
    const signed = await signTransactions(
      itemsToSign,
      personalPassword,
      accountByIdCache,
      nodeByIdCache,
      publicKeyOwnerCache,
    );

    const newTransaction = await getTransactionById(
      user.selectedOrganization.serverUrl,
      props.transactionId,
    );

    emit('transactionSigned', { transaction: newTransaction, signed });
    if (signed) {
      toast.success('Transaction signed successfully', successToastOptions);
    } else {
      toast.error('Transaction not signed', errorToastOptions);
    }
  } catch {
    toast.error('Transaction not signed', errorToastOptions);
  } finally {
    signOnGoing.value = false;
  }
};
</script>

<template>
  <AppButton
    :disabled="!props.signingEnabled || signOnGoing"
    :loading="signOnGoing"
    loading-text="Sign"
    color="primary"
    type="button"
    @click.prevent="handleClick"
  >
    Sign
  </AppButton>
</template>
