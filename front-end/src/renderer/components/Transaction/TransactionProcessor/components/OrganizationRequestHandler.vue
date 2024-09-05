<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';
import type { Handler, TransactionRequest } from '..';

import { computed, ref } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useDraft from '@renderer/composables/useDraft';

import { uint8ArrayToHex } from '@renderer/services/electronUtilsService';
import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { addApprovers, addObservers, submitTransaction } from '@renderer/services/organization';

import { getPrivateKey } from '@renderer/utils';
import { assertIsLoggedInOrganization, assertUserLoggedIn } from '@renderer/utils/userStoreHelpers';

/* Props */
const props = defineProps<{
  observers: number[];
  approvers: TransactionApproverDto[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transaction:submit:success', id: number, body: string): void;
  (event: 'transaction:submit:fail', error: unknown): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetwork();

/* Composables */
const toast = useToast();
const draft = useDraft();

/* State */
const request = ref<TransactionRequest | null>(null);
const nextHandler = ref<Handler | null>(null);

/* Computed */
const transaction = computed(() =>
  request.value ? Transaction.fromBytes(request.value.transactionBytes) : null,
);

/* Actions */
function setNext(next: Handler) {
  nextHandler.value = next;
}

async function handle(req: TransactionRequest) {
  if (!user.selectedOrganization) {
    await nextHandler.value?.handle(req);
    return;
  }

  request.value = req;

  const publicKey = user.keyPairs[0].public_key;

  const signature = await sign(publicKey);
  const { id, body } = await submit(publicKey, signature);

  const results = await Promise.allSettled([
    upload('observers', id),
    upload('approvers', id),
    draft.deleteIfNotTemplate(),
  ]);

  results.forEach(result => {
    if (result.status === 'rejected') {
      toast.error(result.reason.message);
    }
  });

  emit('transaction:submit:success', id, body);
}

/* Functions */
async function sign(publicKey: string) {
  assertUserLoggedIn(user.personal);
  const password = user.getPassword();
  if (!password) throw new Error('Password is required to sign');
  if (!request.value) throw new Error('Request is required to sign');
  if (!transaction.value) throw new Error('Transaction is required to sign');

  /* Get the private key */
  const privateKeyRaw = await decryptPrivateKey(user.personal.id, password, publicKey);
  const privateKey = getPrivateKey(publicKey, privateKeyRaw);

  /* Signs the unfrozen transaction */
  const signatureBytes = privateKey.sign(request.value.transactionBytes);
  const signature = await uint8ArrayToHex(signatureBytes);

  return signature;
}

async function submit(publicKey: string, signature: string) {
  try {
    assertIsLoggedInOrganization(user.selectedOrganization);
    if (!request.value) throw new Error('Request is required to sign');
    if (!transaction.value) throw new Error('Transaction is required to sign');

    const hexTransactionBytes = await uint8ArrayToHex(request.value.transactionBytes);

    return await submitTransaction(
      user.selectedOrganization.serverUrl,
      request.value?.name || '',
      request.value?.description || '',
      hexTransactionBytes,
      network.network,
      signature,
      user.selectedOrganization.userKeys.find(k => k.publicKey === publicKey)?.id || -1,
    );
  } catch (error) {
    emit('transaction:submit:fail', error);
    throw error;
  }
}

async function upload(type: 'observers' | 'approvers', id: number) {
  if (!request.value) throw new Error('Request is required to sign');

  const entities = type === 'observers' ? props.observers : props.approvers;

  if (!entities || entities.length === 0) return;

  assertIsLoggedInOrganization(user.selectedOrganization);

  if (type === 'observers') {
    await addObservers(user.selectedOrganization.serverUrl, id, props.observers);
  } else {
    await addApprovers(user.selectedOrganization.serverUrl, id, props.approvers);
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
