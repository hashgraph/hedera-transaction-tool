<script lang="ts" setup>
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser.ts';
import { assertIsLoggedInOrganization } from '@renderer/utils';
import { getTransactionById } from '@renderer/services/organization';
import AppButton from '@renderer/components/ui/AppButton.vue';
import SignTransactionController from '@renderer/pages/TransactionDetails/SignTransactionController.vue';
import type { ITransactionFull } from '@shared/interfaces';

/* Props */
const props = defineProps<{
  transactionId: number;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transactionSigned', payload: { transactionId: number; signed: boolean }): void;
}>();

/* Stores */
const user = useUserStore();

/* State */
const signStarted = ref<boolean>(false);
const transaction = ref<ITransactionFull | null>(null);

/* Handlers */
const handleClick = async () => {
  assertIsLoggedInOrganization(user.selectedOrganization);

  transaction.value = await getTransactionById(
    user.selectedOrganization.serverUrl,
    props.transactionId,
  );

  signStarted.value = true;
};

const didSign = async (signed: boolean) => {
  emit('transactionSigned', { transactionId: props.transactionId, signed });
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
