<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import usePersonalPassword from '@renderer/composables/usePersonalPassword.ts';
import { useToast } from 'vue-toast-notification';
import { errorToastOptions, successToastOptions } from '@renderer/utils/toastOptions.ts';
import { assertIsLoggedInOrganization, signTransactions } from '@renderer/utils';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { getTransactionGroupById } from '@renderer/services/organization';
import AppConfirmModal from '@renderer/components/ui/AppConfirmModal.vue';

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
const toast = useToast();
const { getPasswordV2 } = usePersonalPassword();

/* Injected */
const accountByIdCache = AccountByIdCache.inject();
const nodeByIdCache = NodeByIdCache.inject();

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
    const group = await getTransactionGroupById(serverUrl, props.groupId);
    const transactions = group.groupItems.map(item => item.transaction);
    const signed = await signTransactions(
      transactions,
      personalPassword,
      accountByIdCache,
      nodeByIdCache,
    );

    emit('transactionGroupSigned', { groupId: props.groupId, signed });
    if (signed) {
      toast.success('Transaction group signed successfully', successToastOptions);
    } else {
      toast.error('Transaction group not signed', errorToastOptions);
    }
  } catch {
    toast.error('Transaction group not signed', errorToastOptions);
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
