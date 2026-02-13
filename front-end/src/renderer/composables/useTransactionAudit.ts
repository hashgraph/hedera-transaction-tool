import { computed, type ComputedRef, type Ref } from 'vue';
import { Key, Transaction as SDKTransaction } from '@hashgraph/sdk';
import {
  computeSignatureKey,
  hexToUint8Array,
  isLoggedInOrganization,
  type SignatureAudit,
} from '@renderer/utils';
import { getTransactionById } from '@renderer/services/organization';
import type { ITransactionFull } from '@shared/interfaces';
import useUserStore from '@renderer/stores/storeUser.ts';
import useNetworkStore from '@renderer/stores/storeNetwork.ts';
import { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';

export interface TransactionAudit {
  transaction: ComputedRef<Promise<ITransactionFull | Error | null>>;
  sdkTransaction: ComputedRef<Promise<SDKTransaction | Error | null>>;
  signatureKey: ComputedRef<Promise<SignatureAudit | null>>;
  externalSignerKeys: ComputedRef<Promise<Set<Key>>>;
}

export default function useTransactionAudit(transactionId: Ref<number | null>): TransactionAudit {
  /* Stores */
  const user = useUserStore();
  const network = useNetworkStore();

  /* Injected */
  const accountByIdCache = AccountByIdCache.inject();
  const nodeByIdCache = NodeByIdCache.inject();

  /* Computed */
  const transaction = computed(async () => {
    let result: ITransactionFull | Error | null;
    if (transactionId.value !== null && isLoggedInOrganization(user.selectedOrganization)) {
      try {
        result = await getTransactionById(user.selectedOrganization.serverUrl, transactionId.value);
      } catch {
        result = null;
      }
    } else {
      result = null;
    }
    return result;
  });

  const sdkTransaction = computed(async () => {
    let result: SDKTransaction | Error | null;

    const tx = await transaction.value;
    if (tx === null || tx instanceof Error) {
      result = null;
    } else {
      try {
        result = SDKTransaction.fromBytes(hexToUint8Array(tx.transactionBytes));
      } catch {
        result = new Error('Failed to decode transaction bytes for ' + transactionId.value);
      }
    }
    return result;
  });

  const signatureKey = computed(async () => {
    let result: SignatureAudit | null;
    const sdkTX = await sdkTransaction.value;
    if (sdkTX === null || sdkTX instanceof Error) {
      result = null;
    } else {
      result = await computeSignatureKey(
        sdkTX,
        network.mirrorNodeBaseURL,
        accountByIdCache,
        nodeByIdCache,
        user.selectedOrganization,
      );
    }
    return result;
  });

  const externalSignerKeys = computed(async () => {
    const sk = await signatureKey.value;
    return sk !== null ? sk.externalKeys : new Set<Key>();
  });

  return {
    transaction,
    sdkTransaction,
    signatureKey,
    externalSignerKeys,
  };
}
