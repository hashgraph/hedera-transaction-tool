<script setup lang="ts">
import type { TransactionApproverDto } from '@shared/interfaces/organization/approvers';
import { TransactionRequest, type Handler, type Processable } from '..';

import { computed, ref } from 'vue';
import { Transaction } from '@hiero-ledger/sdk';

import useUserStore from '@renderer/stores/storeUser';
import useNetwork from '@renderer/stores/storeNetwork';

import { ToastManager } from '@renderer/utils/ToastManager';
import useDraft from '@renderer/composables/useDraft';

import { decryptPrivateKey } from '@renderer/services/keyPairService';
import { addApprovers, addObservers, submitTransaction } from '@renderer/services/organization';
import { ErrorCodes } from '@shared/constants';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  getPrivateKey,
  RequestError,
  uint8ToHex,
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
const toastManager = ToastManager.inject()
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

/**
 * On a duplicate-transactionId (TEX) rejection, the backend already has a
 * transaction for this (payer, validStart) pair. We resubmit with the same
 * validStart bumped by a small nano-offset to produce a unique transactionId.
 *
 * Each attempt draws its offset from a disjoint 333_333 ns bucket inside the
 * original millisecond, so:
 *   - no two attempts can pick the same offset (no wasted retries)
 *   - all retries stay within 1 ms of the user's chosen validStart, which
 *     preserves ordering at millisecond granularity for concurrent submissions
 *
 * A plain sequential +1 ns approach is too narrow: collision windows between
 * concurrent clients are typically wider than a single nanosecond, so each
 * +1 step has high odds of also colliding. Spreading across the millisecond
 * resolves real contention in a single retry the vast majority of the time.
 *
 * Safety: even in the pathological case of 100 concurrent transactions all
 * sharing the same payer + validStart, ~98.6% resolve in a single retry
 * (birthday-collision odds for 99 picks across 333_333 slots is ~1.45%). The
 * rare cases needing a 2nd or 3rd attempt almost always face an empty or
 * near-empty retry pool, since the surviving population collapses fast. Per-
 * round collision odds for a pool of 2 are ~1/333_333 ≈ 3e-6. Probability
 * that any client exhausts all 3 retries is on the order of 10^-13 — about
 * 30,000x rarer than winning Powerball, well past any practical threshold.
 */
const MAX_NANO_RETRIES = 3;

async function handle(req: Processable) {
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

    for (let attempt = 0; attempt <= MAX_NANO_RETRIES; attempt++) {
      if (attempt > 0 && req.bytesFactory) {
        // Bucket N spans [(N-1)*333_333 + 1, N*333_333]; randomized within
        // the bucket so concurrent retriers don't all pick the same offset.
        const jitterNanos = (attempt - 1) * 333_333 + 1 + Math.floor(Math.random() * 333_333);
        request.value.transactionBytes = req.bytesFactory(jitterNanos);
      }

      try {
        const signature = await sign(publicKey);
        const { id, transactionBytes } = await submit(publicKey, signature);

        const results = await Promise.allSettled([
          upload('observers', id),
          upload('approvers', id),
          draft.deleteIfNotTemplate(),
        ]);

        results.forEach(result => {
          if (result.status === 'rejected') {
            toastManager.error(result.reason.message);
          }
        });

        emit('transaction:submit:success', id, transactionBytes);
        return;
      } catch (error) {
        // Only TEX (duplicate transactionId) is retriable via jitter; any
        // other failure surfaces immediately. bytesFactory is required because
        // we need to rebuild the signed bytes with a new validStart. Match on
        // the backend error code rather than the user-facing message so copy
        // changes to ErrorMessages[TEX] don't silently disable retries.
        const canRetry =
          attempt < MAX_NANO_RETRIES &&
          !!req.bytesFactory &&
          error instanceof RequestError &&
          error.code === ErrorCodes.TEX;
        if (canRetry) continue;
        emit('transaction:submit:fail', error);
        throw error;
      }
    }
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
