<script setup lang="ts">
import { TransactionRequest, type Handler, type Processable } from '..';

import { computed, onBeforeUnmount, ref } from 'vue';
import { Transaction, TransactionReceipt, TransactionResponse } from '@hashgraph/sdk';

import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';
import useNetworkStore from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useDraft from '@renderer/composables/useDraft';

import { execute, storeTransaction } from '@renderer/services/transactionService';

import { assertUserLoggedIn, getStatusFromCode } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppLoader from '@renderer/components/ui/AppLoader.vue';
import { getTransactionType } from '@renderer/utils/sdk/transactions';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Emits */
const emit = defineEmits<{
  (
    event: 'transaction:executed',
    success: boolean,
    response: TransactionResponse | null,
    receipt: TransactionReceipt | null,
  ): void;
  (event: 'transaction:stored', id: string): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetworkStore();

/* Composables */
const toast = useToast();
const draft = useDraft();

/* State */
const nextHandler = ref<Handler | null>(null);
const request = ref<TransactionRequest | null>(null);
const isExecuting = ref(false);
const unmounted = ref(false);

/* Computed */
const transaction = computed(() =>
  request.value ? Transaction.fromBytes(request.value.transactionBytes) : null,
);
const type = computed(() => (transaction.value ? getTransactionType(transaction.value) : null));

/* Actions */
function setNext(next: Handler) {
  nextHandler.value = next;
}

async function handle(req: Processable) {
  reset();

  if (!(req instanceof TransactionRequest)) {
    await nextHandler.value?.handle(req);
    return;
  }

  request.value = req;

  assertUserLoggedIn(user.personal);

  await executeTransaction(req.transactionBytes);

  if (nextHandler.value) {
    await nextHandler.value.handle(req);
  }
}

/* Functions */
async function executeTransaction(transactionBytes: Uint8Array) {
  assertUserLoggedIn(user.personal);

  let status = 0;

  try {
    isExecuting.value = true;

    const { response, receipt } = await execute(transactionBytes);

    status = receipt.status?._code;

    emit('transaction:executed', true, response, receipt);

    await draft.deleteIfNotTemplate();

    if (unmounted.value) {
      toast.success('Transaction executed', successToastOptions);
    }
  } catch (err: any) {
    const data = JSON.parse(err.message);
    status = data.status;

    emit('transaction:executed', false, null, null);
    toast.error(data.message);
  } finally {
    isExecuting.value = false;
  }

  await store(status);
}

async function store(status: number) {
  assertUserLoggedIn(user.personal);

  if (!type.value || !transaction.value) throw new Error('Cannot save transaction');

  const tx: Prisma.TransactionUncheckedCreateInput = {
    name: request.value?.name || '',
    type: type.value,
    description: request.value?.description || '',
    transaction_id: transaction.value.transactionId?.toString() || '',
    transaction_hash: (await transaction.value.getTransactionHash()).toString(),
    body: transaction.value.toBytes().toString(),
    status: getStatusFromCode(status) || 'UNKNOWN',
    status_code: status,
    user_id: user.personal.id,
    creator_public_key: null,
    signature: '',
    valid_start: transaction.value.transactionId?.validStart?.toString() || '',
    executed_at: new Date().getTime() / 1000,
    network: network.network,
  };

  const { id } = await storeTransaction(tx);
  emit('transaction:stored', id);
}

function reset() {
  request.value = null;
  isExecuting.value = false;
}

/* Hooks */
onBeforeUnmount(() => (unmounted.value = true));

/* Expose */
defineExpose({
  handle,
  setNext,
});
</script>
<template>
  <!-- Executing modal -->
  <AppModal
    v-model:show="isExecuting"
    class="common-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <div>
        <i class="bi bi-x-lg cursor-pointer" @click="isExecuting = false"></i>
      </div>
      <div class="text-center">
        <AppLoader />
      </div>
      <h3 v-if="transaction" class="text-center text-title text-bold mt-5">
        Executing
        {{ type }}
      </h3>
      <hr class="separator my-5" />

      <div class="d-grid">
        <AppButton color="primary" @click="isExecuting = false">Close</AppButton>
      </div>
    </div>
  </AppModal>
</template>
