import { PublicKey, Transaction as SDKTransaction } from '@hashgraph/sdk';

import { EntityManager, In, Repository } from 'typeorm';

import {
  TransactionSignatureService,
  attachKeys,
  flattenKeyList,
  hasValidSignatureKey,
  smartCollate,
} from '@app/common';

import { User, Transaction, UserKey, TransactionStatus } from '@entities';

export const keysRequiredToSign = async (
  transaction: Transaction,
  transactionSignatureService: TransactionSignatureService,
  entityManager: EntityManager,
  showAll: boolean = false,
  userKeys?: UserKey[],
  cache?: Map<string, UserKey>,
): Promise<UserKey[]> => {
  if (!transaction) return [];

  /* Deserialize the transaction */
  const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

  // list of just public keys that have already signed the transaction
  const signerKeys = sdkTransaction._signerPublicKeys;

  const signature = await transactionSignatureService.computeSignatureKey(transaction, showAll);
  // flatten the key list to an array of public keys
  // and filter out any keys that have already signed the transaction
  const flatPublicKeys = flattenKeyList(signature)
    .map(pk => pk.toStringRaw())
    .filter(pk => !signerKeys.has(pk));

  if (flatPublicKeys.length === 0) return [];

  let results: UserKey[] = [];
  // Now if userKeys is provided, filter out any keys that are not in the flatPublicKeys array
  // this way a user requesting required keys will only see their own keys that are required
  // Otherwise, fetch all UserKeys that are in flatPublicKeys
  if (userKeys) {
    results = userKeys.filter(publicKey => flatPublicKeys.includes(publicKey.publicKey));
  } else {
    if (cache) {
      const cachedKeys: Set<UserKey> = new Set();
      const missingPublicKeys: Set<string> = new Set();

      for (const publicKey of flatPublicKeys) {
        const cached = cache.get(publicKey);
        if (cached) {
          cachedKeys.add(cached);
        } else {
          missingPublicKeys.add(publicKey);
        }
      }

      let fetchedKeys: UserKey[] = [];
      if (missingPublicKeys.size > 0) {
        try {
          fetchedKeys = await entityManager.find(UserKey, {
            where: { publicKey: In([...missingPublicKeys]) },
            relations: ['user'],
          });
          // Store fetched keys in cache
          for (const key of fetchedKeys) {
            cache.set(key.publicKey, key);
          }
        } catch (error) {
          console.error('Error fetching missing user keys:', error);
          throw error;
        }
      }

      results = [...cachedKeys, ...fetchedKeys];
    } else {
      results = await entityManager.find(UserKey, {
        where: { publicKey: In(flatPublicKeys) },
        relations: ['user'],
      });
    }
  }

  return results;
};

export const userKeysRequiredToSign = async (
  transaction: Transaction,
  user: User,
  transactionSignatureService: TransactionSignatureService,
  entityManager: EntityManager,
  showAll: boolean = false,
): Promise<number[]> => {
  await attachKeys(user, entityManager);
  if (user.keys.length === 0) return [];

  const userKeysRequiredToSign = await keysRequiredToSign(
    transaction,
    transactionSignatureService,
    entityManager,
    showAll,
    user.keys
  );

  return userKeysRequiredToSign.map(k => k.id);
};

/* Checks if the signers are enough to sign the transaction and update its status */
export async function processTransactionStatus(
  transactionRepo: Repository<Transaction>,
  transactionSignatureService: TransactionSignatureService,
  transactions: Transaction[],
): Promise<Map<number, TransactionStatus>> {
  const statusChanges = new Map<number, TransactionStatus>();
  const updatesByStatus = new Map<TransactionStatus, number[]>();

  // Process all transactions and group updates as we go
  for (const transaction of transactions) {
    if (!transaction) continue;

    const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

    const signatureKey = await transactionSignatureService.computeSignatureKey(transaction);

    const isAbleToSign = hasValidSignatureKey([...sdkTransaction._signerPublicKeys], signatureKey);

    let newStatus = TransactionStatus.WAITING_FOR_SIGNATURES;

    if (isAbleToSign) {
      const collatedTx = await smartCollate(transaction, signatureKey);

      if (collatedTx !== null) {
        newStatus = TransactionStatus.WAITING_FOR_EXECUTION;
      }
    }

    if (transaction.status !== newStatus) {
      // Track what changed (for return value)
      statusChanges.set(transaction.id, newStatus);

      // Group by status for bulk update
      if (!updatesByStatus.has(newStatus)) {
        updatesByStatus.set(newStatus, []);
      }
      updatesByStatus.get(newStatus)!.push(transaction.id);
    }
  }

  // Execute one update per unique status
  if (updatesByStatus.size > 0) {
    await Promise.all(
      Array.from(updatesByStatus.entries()).map(([status, ids]) =>
        transactionRepo.update({ id: In(ids) }, { status }),
      ),
    );
  }

  return statusChanges;
}

export interface SigningReport {
  internalSigners: Set<String>;
  externalSigners: Set<String>;
  internalSignatures: Set<String>;
  externalSignatures: Set<String>;
  unexpectedSignatures: Set<String>;
}

export async function produceSigningReport(
  transaction: Transaction,
  transactionSignatureService: TransactionSignatureService,
  entityManager: EntityManager,
): Promise<SigningReport> {
  const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

  // Lists public keys that have already signed the transaction
  const signatureKeys = sdkTransaction._signerPublicKeys;

  // Lists sdk keys that needs to sign the transaction
  const sdkKeyList = await transactionSignatureService.computeSignatureKey(transaction);
  const signerKeys = new Set<string>();
  for (const k of flattenKeyList(sdkKeyList)) {
    signerKeys.add(k.toStringRaw());
  }

  // Filters signers and signatures
  let internalSigners = new Set<string>();
  let externalSigners = new Set<string>();
  let internalSignatures = new Set<string>();
  let externalSignatures = new Set<string>();
  for (const k of signerKeys) {
    const signed = signatureKeys.has(k);
    const userId = await findUserByKey(k, entityManager);
    if (signed) {
      // Transaction is already signed with k
      if (userId !== null) {
        internalSignatures.add(k);
      } else {
        externalSignatures.add(k);
      }
    } else {
      // Transaction is not signed with k yet
      if (userId !== null) {
        internalSigners.add(k);
      } else {
        externalSigners.add(k);
      }
    }
  }
  let unexpectedSignatures = new Set<string>();
  for (const k of signatureKeys) {
    if (!signerKeys.has(k)) {
      // Transaction is signed with k but this is not expected
      unexpectedSignatures.add(k);
    }
  }

  return {
    internalSigners,
    externalSigners,
    internalSignatures,
    externalSignatures,
    unexpectedSignatures,
  };
}

export async function produceSigningReportForArray(
  transactions: Transaction[],
  transactionSignatureService: TransactionSignatureService,
  entityManager: EntityManager,
): Promise<SigningReport> {
  const result: SigningReport = {
    internalSigners: new Set<string>(),
    externalSigners: new Set<string>(),
    internalSignatures: new Set<string>(),
    externalSignatures: new Set<string>(),
    unexpectedSignatures: new Set<string>(),
  };

  for (const t of transactions) {
    const r = await produceSigningReport(t, transactionSignatureService, entityManager);
    r.internalSigners.forEach(s => result.internalSigners.add(s));
    r.externalSigners.forEach(s => result.externalSigners.add(s));
    r.internalSignatures.forEach(s => result.internalSignatures.add(s));
    r.externalSignatures.forEach(s => result.externalSignatures.add(s));
    r.unexpectedSignatures.forEach(s => result.unexpectedSignatures.add(s));
  }

  return result;
}

async function findUserByKey(publicKey: string, entityManager: EntityManager): Promise<number|null> {
  const userKey = await entityManager.find(UserKey, {
    where: {publicKey: publicKey, deletedAt: null }
  })
  return userKey[0]?.userId ?? null;
}
