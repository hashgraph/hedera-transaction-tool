<script setup lang="ts">
import { Transaction } from '@hashgraph/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import { getDollarAmount } from '@renderer/services/mirrorNodeDataService';

import { getTransactionType, stringifyHbar } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  transaction: Transaction;
  signing: boolean;
}>();

/* Emits */
const emit = defineEmits(['update:show', 'transaction:confirm']);

/* Stores */
const network = useNetworkStore();

/* Handlers */
const handleConfirmTransaction = (e: Event) => {
  e.preventDefault();

  emit('transaction:confirm');
};
</script>
<template>
  <!-- Confirm modal -->
  <AppModal
    :show="show"
    @update:show="emit('update:show', $event)"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="emit('update:show', false)"></i>
      </div>
      <div class="text-center">
        <i class="bi bi-arrow-left-right large-icon"></i>
      </div>
      <form @submit="handleConfirmTransaction">
        <h3 class="text-center text-title text-bold mt-5">Confirm Transaction</h3>
        <div class="container-main-bg text-small p-4 mt-5">
          <div class="d-flex justify-content-between p-3">
            <p>Type of Transaction</p>
            <p data-testid="p-type-transaction">{{ getTransactionType(props.transaction) }}</p>
          </div>
          <div class="d-flex justify-content-between p-3 mt-3">
            <p>Transaction ID</p>
            <p class="text-secondary" data-testid="p-transaction-id">
              {{ transaction?.transactionId }}
            </p>
          </div>
          <div class="d-flex justify-content-between p-3 mt-3">
            <p>Valid Start</p>
            <p class="">
              {{ transaction?.transactionId?.validStart?.toDate().toDateString() }}
            </p>
          </div>
          <div
            v-if="transaction?.maxTransactionFee"
            class="d-flex justify-content-between p-3 mt-3"
          >
            <p>Max Transaction Fee</p>
            <p class="" data-testid="p-max-tx-fee">
              {{ stringifyHbar(transaction.maxTransactionFee) }} ({{
                getDollarAmount(network.currentRate, transaction.maxTransactionFee.toBigNumber())
              }})
            </p>
          </div>
        </div>

        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4">
          <AppButton
            type="button"
            color="borderless"
            data-testid="button-cancel-transaction"
            @click="emit('update:show', false)"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-sign-transaction"
            :loading="signing"
            :disabled="signing"
            >Sign</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
