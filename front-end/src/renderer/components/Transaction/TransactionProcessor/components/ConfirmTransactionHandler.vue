<script setup lang="ts">
import { CustomRequest, TransactionRequest, type Handler, type Processable } from '..';

import { computed, ref } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import useNetworkStore from '@renderer/stores/storeNetwork';

import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { getDollarAmount } from '@renderer/services/mirrorNodeDataService';

import { stringifyHbar } from '@renderer/utils';
import { getTransactionType } from '@renderer/utils/sdk/transactions';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
defineProps<{
  loading: boolean;
}>();

/* Stores */
const network = useNetworkStore();

/* Composables */
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const request = ref<Processable | null>(null);
const nextHandler = ref<Handler | null>(null);
const show = ref(false);

/* Computed */
const transaction = computed(() =>
  request.value instanceof TransactionRequest
    ? Transaction.fromBytes(request.value.transactionBytes)
    : null,
);

/* Actions */
async function next() {
  if (nextHandler.value && request.value) {
    await nextHandler.value.handle(request.value as Processable);
  }
}

function setNext(next: Handler) {
  nextHandler.value = next;
}

function handle(req: Processable) {
  reset();

  request.value = req;
  show.value = true;
}

function setShow(value: boolean) {
  show.value = value;
}

/* Handlers */
const handleConfirmTransaction = async () => {
  const personalPassword = getPassword(next, {
    subHeading: 'Enter your application password to sign the transaction',
  });
  if (passwordModalOpened(personalPassword)) return;

  await next();
};

/* Functions */

function reset() {
  request.value = null;
  show.value = false;
}

/* Expose */
defineExpose({
  handle,
  setNext,
  setShow,
});
</script>
<template>
  <!-- Confirm modal -->
  <AppModal v-model:show="show" :close-on-click-outside="false" :close-on-escape="false">
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="show = false"></i>
      </div>
      <div class="text-center">
        <i class="bi bi-arrow-left-right large-icon"></i>
      </div>
      <form v-if="transaction" @submit.prevent="handleConfirmTransaction">
        <h3 class="text-center text-title text-bold mt-5">Confirm Transaction</h3>
        <div class="container-main-bg text-small p-4 mt-5">
          <div class="d-flex justify-content-between p-3">
            <p>Type of Transaction</p>
            <p data-testid="p-type-transaction">{{ getTransactionType(transaction) }}</p>
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
            @click="show = false"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-sign-transaction"
            :loading="loading"
            :disabled="loading"
            >Confirm</AppButton
          >
        </div>
      </form>
      <form v-else-if="request instanceof CustomRequest" @submit.prevent="handleConfirmTransaction">
        <h3 class="text-center text-title text-bold mt-5">Confirm Transaction</h3>
        <div class="container-main-bg text-small p-4 mt-5">
          <div class="d-flex justify-content-between p-3">
            <p>Type of Request</p>
            <p data-testid="p-type-transaction">{{ request.displayName }}</p>
          </div>
          <div class="d-flex justify-content-between p-3 mt-3">
            <p>Valid Start</p>
            <p class="">
              {{ request.baseValidStart?.toDateString() }}
            </p>
          </div>
          <div v-if="request.maxTransactionFee" class="d-flex justify-content-between p-3 mt-3">
            <p>Max Transaction Fee</p>
            <p class="" data-testid="p-max-tx-fee">
              {{ stringifyHbar(request.maxTransactionFee) }} ({{
                getDollarAmount(network.currentRate, request.maxTransactionFee.toBigNumber())
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
            @click="show = false"
            >Cancel</AppButton
          >
          <AppButton
            color="primary"
            type="submit"
            data-testid="button-sign-transaction"
            :loading="loading"
            :disabled="loading"
            >Confirm</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
