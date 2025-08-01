import { Transaction as SDKTransaction } from '@hashgraph/sdk';

import { EntityManager, In } from 'typeorm';

import {
  MirrorNodeService,
  attachKeys,
  computeSignatureKey,
  flattenKeyList,
} from '@app/common';
import { User, Transaction, UserKey, TransactionSigner } from '@entities';

export const keysRequiredToSign = async (
  transaction: Transaction,
  mirrorNodeService: MirrorNodeService,
  entityManager: EntityManager,
  userKeys?: UserKey[],
): Promise<UserKey[]> => {
  if (!transaction) return [];

  const signatures = await entityManager.find(TransactionSigner, {
    where: {
      transaction: {
        id: transaction.id,
      },
    },
    relations: {
      userKey: true,
    },
    withDeleted: true,
  });

  // list of just public keys that have already signed the transaction
  const signerKeys = signatures.map(s => s.userKey.publicKey);

  /* Deserialize the transaction */
  const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

  const signature = await computeSignatureKey(sdkTransaction, mirrorNodeService, transaction.mirrorNetwork);
  // flatten the key list to an array of public keys
  // and filter out any keys that have already signed the transaction
  const flatPublicKeys = flattenKeyList(signature)
    .map(pk => pk.toStringRaw())
    .filter(pk => !signerKeys.includes(pk));

  if (flatPublicKeys.length === 0) return [];

  let results: UserKey[] = [];
  // Now if userKeys is provided, filter out any keys that are not in the flatPublicKeys array
  // this way a user requesting required keys will only see their own keys that are required
  // Otherwise, fetch all UserKeys that are in flatPublicKeys
  if (userKeys) {
    results = userKeys.filter(publicKey =>
        flatPublicKeys.includes(publicKey.publicKey)
    );
  } else {
    results = await entityManager.find(UserKey, {
      where: {
        publicKey: In(flatPublicKeys),
      },
    });
  }

  return results;
};

export const userKeysRequiredToSign = async (
  transaction: Transaction,
  user: User,
  mirrorNodeService: MirrorNodeService,
  entityManager: EntityManager,
): Promise<number[]> => {
  await attachKeys(user, entityManager);
  if (user.keys.length === 0) return [];

  const userKeysRequiredToSign = await keysRequiredToSign(
    transaction,
    mirrorNodeService,
    entityManager,
    user.keys,
  );

  return userKeysRequiredToSign.map(k => k.id);
};

export const getNetwork = (transaction: Transaction) => {
  const network = transaction.mirrorNetwork;
  const defaultNetworks = ['mainnet', 'testnet', 'previewnet', 'local-node'];
  const isCustom = !defaultNetworks.includes(network);
  const networkString = isCustom
    ? network
    : network.charAt(0).toUpperCase() + network.slice(1).toLowerCase();
  return networkString;
};
