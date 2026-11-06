<script setup lang="ts" generic="T extends Transaction">
import { TransactionRequest, type Handler, type Processable } from '..';

import { computed, ref, type Ref } from 'vue';
import { Transaction } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { flattenKeyList } from '@renderer/services/keyPairService';
import { signTransaction } from '@renderer/services/transactionService';

import { assertTransactionType, assertUserLoggedIn } from '@renderer/utils';
import type { TransactionCtor } from '@renderer/components/Transaction/Create/BaseTransaction/BaseDraftLoad.vue';

/* Props */
const props = defineProps<{
  transactionCtor: TransactionCtor<T>;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transaction:sign:begin'): void;
  (event: 'transaction:sign:success'): void;
  (event: 'transaction:sign:fail'): void;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const { getPasswordAsync } = usePersonalPassword();

/* State */
const request: Ref<TransactionRequest<T> | null> = ref(null);
const nextHandler: Ref<Handler<T> | null> = ref(null);

/* Computed */
const localPublicKeys = computed(() => {
  const key = request.value?.transactionKey;
  if (!key) return [];

  const flattenedSignatureKey = flattenKeyList(key).map(pk => pk.toStringRaw());
  return flattenedSignatureKey.filter(pk => user.publicKeys.includes(pk));
});
const transaction = computed(() => request.value?.transaction ?? null);

/* Actions */
function setNext(next: Handler<T>) {
  nextHandler.value = next;
}

async function handle(req: Processable<T>) {
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
  const password = await getPasswordAsync({
    subHeading: 'Enter your application password to sign the transaction',
  });
  if (password === false) return;

  emit('transaction:sign:begin');

  try {
    const signed = await signTransaction(
      request.value.transaction.toBytes(),
      localPublicKeys.value,
      user.personal.id,
      password,
    );

    emit('transaction:sign:success');

    const signedTransaction = Transaction.fromBytes(signed);
    assertTransactionType(signedTransaction, props.transactionCtor);
    request.value.transaction = signedTransaction;
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
