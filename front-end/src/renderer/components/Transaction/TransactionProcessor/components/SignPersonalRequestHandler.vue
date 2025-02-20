<script setup lang="ts">
import { TransactionRequest, type Handler, type Processable } from '..';

import { computed, ref } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';

import { flattenKeyList } from '@renderer/services/keyPairService';
import { signTransaction } from '@renderer/services/transactionService';

import { assertUserLoggedIn } from '@renderer/utils';

/* Emits */
const emit = defineEmits<{
  (event: 'transaction:sign:begin'): void;
  (event: 'transaction:sign:success'): void;
  (event: 'transaction:sign:fail'): void;
}>();

/* Stores */
const user = useUserStore();

/* State */
const request = ref<TransactionRequest | null>(null);
const nextHandler = ref<Handler | null>(null);

/* Computed */
const localPublicKeys = computed(() => {
  const key = request.value?.transactionKey;
  if (!key) return [];

  const flattenedSignatureKey = flattenKeyList(key).map(pk => pk.toStringRaw());
  return flattenedSignatureKey.filter(pk => user.publicKeys.includes(pk));
});
const transaction = computed(() =>
  request.value ? Transaction.fromBytes(request.value.transactionBytes) : null,
);

/* Actions */
function setNext(next: Handler) {
  nextHandler.value = next;
}

async function handle(req: Processable) {
  if (!(req instanceof TransactionRequest)) {
    await nextHandler.value?.handle(req);
    return;
  }

  request.value = req;

  if (localPublicKeys.value.length === 0)
    throw new Error(
      'Unable to execute, all of the required signatures should be with your keys. You are currently in Personal mode.',
    );

  await sign();
}

/* Functions */
async function sign() {
  if (!request.value) throw new Error('Request is required to sign');
  if (!transaction.value) throw new Error('Transaction is required to sign');
  assertUserLoggedIn(user.personal);
  const password = user.getPassword();
  if (!password && !user.personal.useKeychain) throw new Error('Password is required to sign');

  emit('transaction:sign:begin');

  try {
    const signed = await signTransaction(
      request.value.transactionBytes,
      localPublicKeys.value,
      user.personal.id,
      password,
    );

    emit('transaction:sign:success');

    request.value.transactionBytes = signed;
    await nextHandler.value?.handle(request.value);
  } catch (error) {
    emit('transaction:sign:fail');
    throw error;
  }
}

/* Expose */
defineExpose({
  handle,
  setNext,
});
</script>
<template>
  <div></div>
</template>
