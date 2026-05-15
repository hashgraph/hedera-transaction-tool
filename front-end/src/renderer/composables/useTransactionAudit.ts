import { computed, type ComputedRef, type Ref } from 'vue';
import { Key, Transaction as SDKTransaction } from '@hiero-ledger/sdk';
import {
  createLogger,
  hexToUint8Array,
  isLoggedInOrganization,
  type SignatureAudit,
} from '@renderer/utils';
import type { ITransactionFull } from '@shared/interfaces';
import useUserStore from '@renderer/stores/storeUser.ts';
import useNetworkStore from '@renderer/stores/storeNetwork.ts';
import { AppCache } from '@renderer/caches/AppCache';

const logger = createLogger('renderer.useTransactionAudit');

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
  const appCache = AppCache.inject();

  /* Computed */
  const transaction = computed(async () => {
    let result: ITransactionFull | Error | null;
    if (transactionId.value !== null && isLoggedInOrganization(user.selectedOrganization)) {
      try {
        result = await appCache.backendTransaction.lookup(
          transactionId.value,
          user.selectedOrganization.serverUrl,
        );
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
      try {
        result = await appCache.computeSignatureKey(
          sdkTX,
          user.selectedOrganization,
          network.mirrorNodeBaseURL,
        );
      } catch (error) {
        result = null;
        logger.error('Failed to compute signature key', { error });
      }
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
