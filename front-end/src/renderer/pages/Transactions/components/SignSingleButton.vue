<script lang="ts" setup>
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import { assertIsLoggedInOrganization } from '@renderer/utils';
import { BackendTransactionCache } from '@renderer/caches/backend/BackendTransactionCache.ts';
import AppButton from '@renderer/components/ui/AppButton.vue';
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
const transactionCache = BackendTransactionCache.inject();

/* Stores */
const user = useUserStore();

/* State */
const signStarted = ref<boolean>(false);
const transaction = ref<ITransactionFull | null>(null);

/* Handlers */
const handleClick = async () => {
  assertIsLoggedInOrganization(user.selectedOrganization);

  transaction.value = await transactionCache.lookup(
    props.transactionId,
    user.selectedOrganization.serverUrl,
  );

  signStarted.value = true;
};

const didSign = async () => {
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

  <SignTransactionController
    v-model:activate="signStarted"
    :callback="didSign"
    :transaction="transaction"
  />
</template>
