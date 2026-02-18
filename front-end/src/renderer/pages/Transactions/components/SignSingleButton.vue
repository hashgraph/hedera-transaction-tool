<script setup lang="ts">
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import usePersonalPassword from '@renderer/composables/usePersonalPassword.ts';
import { useToast } from 'vue-toast-notification';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';
import { assertIsLoggedInOrganization, signTransactions } from '@renderer/utils';
import { getTransactionById } from '@renderer/services/organization';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import AppButton from '@renderer/components/ui/AppButton.vue';

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
const toast = useToast();
const { getPasswordV2 } = usePersonalPassword();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();

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
    );

    emit('transactionSigned', { transactionId: props.transactionId, signed });
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
