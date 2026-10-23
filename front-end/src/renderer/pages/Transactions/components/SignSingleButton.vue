<script lang="ts" setup>
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import {
  assertIsLoggedInOrganization,
  getCreatorSignatureStatus,
  snapshotTransaction,
  type CreatorSignatureStatus,
} from '@renderer/utils';
import { AppCache } from '@renderer/caches/AppCache.ts';
import AppButton from '@renderer/components/ui/AppButton.vue';
import CreatorSignatureConfirmModal from '@renderer/components/CreatorSignatureConfirmModal.vue';
import SignTransactionController from '@renderer/pages/TransactionDetails/SignTransactionController.vue';
import type { ITransactionFull } from '@shared/interfaces';

/* Props */
const props = defineProps<{
  transactionId: number;
  refreshTransaction?: boolean;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transactionSigned', payload: { transaction: ITransactionFull }): void;
}>();

/* Injected */
const transactionCache = AppCache.inject().backendTransaction;

/* Stores */
const user = useUserStore();

/* State */
const signStarted = ref<boolean>(false);
const transaction = ref<ITransactionFull | null>(null);
const showUnverifiedConfirm = ref(false);
const creatorSignatureStatus = ref<CreatorSignatureStatus>('verified');

/* Handlers */
const handleClick = async () => {
  assertIsLoggedInOrganization(user.selectedOrganization);

  transaction.value = snapshotTransaction(
    await transactionCache.lookup(props.transactionId, user.selectedOrganization.serverUrl),
  );

  creatorSignatureStatus.value = getCreatorSignatureStatus(
    transaction.value,
    user.selectedOrganization.userKeys,
  );

  if (creatorSignatureStatus.value === 'verified') {
    signStarted.value = true;
  } else {
    showUnverifiedConfirm.value = true;
  }
};

const didSign = async (signed: boolean) => {
  if (!signed) return;

  if (props.refreshTransaction) {
    assertIsLoggedInOrganization(user.selectedOrganization);

    const newTransaction = await transactionCache.lookup(
      props.transactionId,
      user.selectedOrganization.serverUrl,
    );
    emit('transactionSigned', { transaction: newTransaction });
  } else {
    emit('transactionSigned', { transaction: transaction.value! });
  }
};
</script>

<template>
  <AppButton
    color="primary"
    loading-text="Sign"
    type="button"
    v-bind="$attrs"
    @click.prevent="handleClick"
  >
    Sign
  </AppButton>

  <CreatorSignatureConfirmModal
    v-model:show="showUnverifiedConfirm"
    :status="creatorSignatureStatus"
    :callback="() => (signStarted = true)"
  />
  <SignTransactionController
    v-model:activate="signStarted"
    :callback="didSign"
    :transaction="transaction"
  />
</template>
