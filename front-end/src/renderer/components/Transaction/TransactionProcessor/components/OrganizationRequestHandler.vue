<script setup lang="ts">
import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';
import type { ITransaction } from '@main/shared/interfaces';
import { TransactionRequest, type Handler, type Processable } from '..';

import { computed, ref } from 'vue';
import { Transaction } from '@hashgraph/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';

import { useToast } from 'vue-toast-notification';
import useDraft from '@renderer/composables/useDraft';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { decryptPrivateKey } from '@renderer/services/keyPairService';
import {
  addApprovers,
  addObservers,
  submitTransaction,
  uploadSignatureMap,
} from '@renderer/services/organization';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  getPrivateKey,
  hexToUint8Array,
  uint8ToHex,
  usersPublicRequiredToSign,
} from '@renderer/utils';

/* Props */
const props = defineProps<{
  observers: number[];
  approvers: TransactionApproverDto[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'transaction:submit:success', id: number, transactionBytes: string): void;
  (event: 'transaction:submit:fail', error: unknown): void;
  (event: 'loading:begin'): void;
  (event: 'loading:end'): void;
}>();

/* Stores */
const user = useUserStore();
const network = useNetwork();

/* Composables */
const toast = useToast();
const draft = useDraft();
const { getPassword, passwordModalOpened } = usePersonalPassword();

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

async function handle(req: Processable) {
  console.log('OrganizationRequestHandler: handle');

  if (!(req instanceof TransactionRequest)) {
    await nextHandler.value?.handle(req);
    return;
  }

  if (!user.selectedOrganization) {
    await nextHandler.value?.handle(req);
    return;
  }

  request.value = req;

  const publicKey = user.keyPairs[0].public_key;

  try {
    emit('loading:begin');
    const signature = await sign(publicKey);
    const transactionDTO = await submit(publicKey, signature);

    const results = await Promise.allSettled([
      upload('observers', transactionDTO.id),
      upload('approvers', transactionDTO.id),
      draft.deleteIfNotTemplate(),
      uploadSignatures(transactionDTO),
    ]);

    results.forEach(result => {
      if (result.status === 'rejected') {
        toast.error(result.reason.message);
      }
    });

    emit('transaction:submit:success', transactionDTO.id, transactionDTO.transactionBytes);
  } finally {
    emit('loading:end');
  }
}

/* Functions */
async function sign(publicKey: string) {
  assertUserLoggedIn(user.personal);
  const password = user.getPassword();
  if (!password && !user.personal.useKeychain) throw new Error('Password is required to sign');
  if (!request.value) throw new Error('Request is required to sign');
  if (!transaction.value) throw new Error('Transaction is required to sign');

  /* Get the private key */
  const privateKeyRaw = await decryptPrivateKey(user.personal.id, password, publicKey);
  const privateKey = getPrivateKey(publicKey, privateKeyRaw);

  /* Signs the unfrozen transaction */
  const signatureBytes = privateKey.sign(request.value.transactionBytes);
  const signature = uint8ToHex(signatureBytes);

  return signature;
}

async function submit(publicKey: string, signature: string) {
  try {
    assertIsLoggedInOrganization(user.selectedOrganization);
    if (!request.value) throw new Error('Request is required to sign');
    if (!transaction.value) throw new Error('Transaction is required to sign');

    const hexTransactionBytes = uint8ToHex(request.value.transactionBytes);

    return await submitTransaction(
      user.selectedOrganization.serverUrl,
      request.value?.name || '',
      request.value?.description || '',
      hexTransactionBytes,
      network.network,
      signature,
      user.selectedOrganization.userKeys.find(k => k.publicKey === publicKey)?.id || -1,
      request.value.submitManually,
      request.value.reminderMillisecondsBefore,
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

async function uploadSignatures(transactionDTO: ITransaction) {
  if (request.value?.executionType !== 'Scheduled') {
    return;
  }

  assertUserLoggedIn(user.personal);
  assertIsLoggedInOrganization(user.selectedOrganization);

  const personalPassword = getPassword(uploadSignatures.bind(null, transactionDTO), {
    subHeading: 'Enter your application password to access your private key',
  });
  if (passwordModalOpened(personalPassword)) return;

  const bytes = hexToUint8Array(transactionDTO.transactionBytes);
  const transaction = Transaction.fromBytes(bytes);

  const publicKeysRequired = await usersPublicRequiredToSign(
    transaction,
    user.selectedOrganization.userKeys,
    network.mirrorNodeBaseURL,
  );

  const restoredRequiredKeys = [];
  const requiredNonRestoredKeys = [];

  for (const requiredKey of publicKeysRequired) {
    if (user.keyPairs.some(k => k.public_key === requiredKey)) {
      restoredRequiredKeys.push(requiredKey);
    } else {
      requiredNonRestoredKeys.push(requiredKey);
    }
  }

  if (restoredRequiredKeys.length > 0) {
    await uploadSignatureMap(
      user.personal.id,
      personalPassword,
      user.selectedOrganization,
      restoredRequiredKeys,
      transaction,
      transactionDTO.id,
    );
    toast.success('Transaction signed successfully');
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
