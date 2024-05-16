import { KeyList, Key, PublicKey, Transaction as SDKTransaction } from '@hashgraph/sdk';

import { EntityManager } from 'typeorm';

import {
  isExpired,
  getSignatureEntities,
  isPublicKeyInKeyList,
  parseAccountProperty,
  MirrorNodeService,
} from '@app/common';
import { User, Transaction, TransactionStatus, UserKey, TransactionSigner } from '@entities';

export const userKeysRequiredToSign = async (
  transaction: Transaction,
  user: User,
  mirrorNodeService: MirrorNodeService,
  entityManager: EntityManager,
): Promise<number[]> => {
  const userKeyIdsRequired: Set<number> = new Set<number>();

  if (!transaction || transaction.status != TransactionStatus.WAITING_FOR_SIGNATURES) {
    return [];
  }

  /* Ensures the user keys are passed */
  if (user.keys.length === 0) {
    user.keys = await entityManager.find(UserKey, { where: { user: { id: user.id } } });
    if (user.keys.length === 0) return [];
  }

  /* Gets the user signatures for this transaction */
  const signatures = await entityManager.find(TransactionSigner, {
    where: {
      transaction: {
        id: transaction.id,
      },
      user: {
        id: user.id,
      },
    },
    relations: {
      userKey: true,
    },
    withDeleted: true,
  });

  /* Deserialize the transaction */
  const sdkTransaction = SDKTransaction.fromBytes(transaction.body);

  /* Ignore if expired */
  if (isExpired(sdkTransaction)) return [];

  /* Get signature entities */
  const { newKeys, accounts, receiverAccounts } = getSignatureEntities(sdkTransaction);

  /* Check if the user has a key that is required to sign */
  const userKeysIncludedInTransaction = user.keys.filter(
    userKey =>
      newKeys.some(key =>
        isPublicKeyInKeyList(userKey.publicKey, key instanceof KeyList ? key : new KeyList([key])),
      ) && !signatures.some(s => s.userKey.publicKey === userKey.publicKey),
  );
  userKeysIncludedInTransaction.forEach(userKey => userKeyIdsRequired.add(userKey.id));

  const userKeyInKeyOrIsKey = (key: Key) =>
    (key instanceof PublicKey &&
      user.keys.filter(
        userKey =>
          userKey.publicKey === key.toStringRaw() &&
          !signatures.some(s => s.userKey.publicKey === userKey.publicKey),
      )) ||
    (key instanceof KeyList &&
      user.keys.filter(
        userKey =>
          isPublicKeyInKeyList(userKey.publicKey, key) &&
          !signatures.some(s => s.userKey.publicKey === userKey.publicKey),
      ));

  /* Check if a key of the user is inside the key of some account required to sign */
  for (const accountId of accounts) {
    const accountInfo = await mirrorNodeService.getAccountInfo(accountId);
    const key = parseAccountProperty(accountInfo, 'key');
    if (!key) continue;

    userKeyInKeyOrIsKey(key).forEach(userKey => userKeyIdsRequired.add(userKey.id));
  }

  /* Check if user has a key included in a receiver account that required signature */
  for (const accountId of receiverAccounts) {
    const accountInfo = await mirrorNodeService.getAccountInfo(accountId);
    const receiverSigRequired = parseAccountProperty(accountInfo, 'receiver_sig_required');
    if (!receiverSigRequired) continue;

    const key = parseAccountProperty(accountInfo, 'key');
    if (!key) continue;

    userKeyInKeyOrIsKey(key).forEach(userKey => userKeyIdsRequired.add(userKey.id));
  }

  return [...userKeyIdsRequired];
};
