<script setup lang="ts">
import type { USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';
import type { Handler, TransactionRequest } from '..';

import { computed, inject, ref } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { getDollarAmount } from '@renderer/services/mirrorNodeDataService';

import { getTransactionType, stringifyHbar } from '@renderer/utils';

import { USER_PASSWORD_MODAL_KEY } from '@renderer/providers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';

/* Props */
defineProps<{
  signing: boolean;
}>();

/* Stores */
const network = useNetworkStore();
const user = useUserStore();

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

/* State */
const request = ref<TransactionRequest | null>(null);
const nextHandler = ref<Handler | null>(null);
const show = ref(false);

/* Computed */
const transaction = computed(() =>
  request.value ? Transaction.fromBytes(request.value.transactionBytes) : null,
);

/* Actions */
async function next() {
  if (nextHandler.value && request.value) {
    await nextHandler.value.handle(request.value);
  }
}

function setNext(next: Handler) {
  nextHandler.value = next;
}

function handle(req: TransactionRequest) {
  request.value = req;
  show.value = true;
}

function setShow(value: boolean) {
  show.value = value;
}

/* Handlers */
const handleConfirmTransaction = async (e: Event) => {
  e.preventDefault();

  const hasPassword = assertPassword();
  if (!hasPassword) return;

  await next();
};

/* Functions */
function assertPassword() {
  const personalPassword = user.getPassword();
  if (!personalPassword) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    show.value = false;
    userPasswordModalRef.value?.open(
      'Enter your application password',
      'Enter your application password to sign the transaction',
      next,
    );
    return false;
  }

  return true;
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
      <form v-if="transaction" @submit="handleConfirmTransaction">
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
            :loading="signing"
            :disabled="signing"
            >Create</AppButton
          >
        </div>
      </form>
    </div>
  </AppModal>
</template>
