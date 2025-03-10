import {
  Key,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  Transaction as SDKTransaction,
} from '@hashgraph/sdk';

import { EntityManager, In, Not } from 'typeorm';

import {
  getSignatureEntities,
  isPublicKeyInKeyList,
  MirrorNodeService,
  attachKeys,
  parseAccountInfo,
  parseNodeInfo,
  transactionIs,
  safeAwait,
  COUNCIL_ACCOUNTS,
} from '@app/common';
import { User, Transaction, UserKey, TransactionSigner } from '@entities';

export const keysRequiredToSign = async (
  transaction: Transaction,
  mirrorNodeService: MirrorNodeService,
  entityManager: EntityManager,
  userKeys?: UserKey[],
): Promise<UserKey[]> => {
  const userKeyIdsRequired: Set<number> = new Set<number>();

  if (!transaction) return [];

  /* Deserialize the transaction */
  const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

  /* Get the user signatures for this transaction */
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

  /* Signer keys */
  const signerKeys = signatures.map(s => s.userKey);

  /* Get all keys */
  if (!userKeys) {
    userKeys = await entityManager.find(UserKey, {
      where: {
        id: Not(In(signerKeys.map(k => k.id))),
      },
    });
  }

  /* Get signature entities */
  const { newKeys, accounts, receiverAccounts, nodeId } = getSignatureEntities(sdkTransaction);

  /* Check if the user has a key that is required to sign */
  for (const userKey of userKeys) {
    const includedInTransaction =
      newKeys.some(key => isPublicKeyInKeyList(userKey.publicKey, key)) &&
      !signatures.some(s => s.userKey.publicKey === userKey.publicKey);

    if (includedInTransaction) {
      userKeyIdsRequired.add(userKey.id);
    }
  }

  const addUserPublicKeyIfRequired = (key: Key) => {
    const userKeysRequired = userKeys.filter(
      userKey =>
        isPublicKeyInKeyList(userKey.publicKey, key) &&
        !signatures.some(s => s.userKey.publicKey === userKey.publicKey),
    );
    userKeysRequired.forEach(userKey => userKeyIdsRequired.add(userKey.id));
  };

  /* Check if a key of the user is inside the key of some account required to sign */
  for (const accountId of accounts) {
    try {
      const accountInfo = parseAccountInfo(
        await mirrorNodeService.getAccountInfo(accountId, transaction.mirrorNetwork),
      );
      if (!accountInfo.key) continue;
      addUserPublicKeyIfRequired(accountInfo.key);
    } catch (error) {
      console.log(error);
    }
  }

  /* Check if user has a key included in a receiver account that required signature */
  for (const accountId of receiverAccounts) {
    try {
      const accountInfo = parseAccountInfo(
        await mirrorNodeService.getAccountInfo(accountId, transaction.mirrorNetwork),
      );
      if (!accountInfo.receiverSignatureRequired || !accountInfo.key) continue;
      addUserPublicKeyIfRequired(accountInfo.key);
    } catch (error) {
      console.log(error);
    }
  }

  /* Check if user has a key included in the node admin key */
  try {
    if (!isNaN(nodeId)) {
      const nodeInfo = parseNodeInfo(
        await mirrorNodeService.getNodeInfo(nodeId, transaction.mirrorNetwork),
      );
      if (nodeInfo.admin_key) {
        addUserPublicKeyIfRequired(nodeInfo.admin_key);
      }

      if (transactionIs(NodeUpdateTransaction, sdkTransaction)) {
        const nodeAccountId = nodeInfo?.node_account_id?.toString() || null;
        if (sdkTransaction.accountId && nodeAccountId) {
          const accountInfo = parseAccountInfo(
            await mirrorNodeService.getAccountInfo(nodeAccountId, transaction.mirrorNetwork),
          );
          if (accountInfo?.key) {
            addUserPublicKeyIfRequired(accountInfo.key);
          }
        }
      }

      if (transactionIs(NodeDeleteTransaction, sdkTransaction)) {
        for (const acc of COUNCIL_ACCOUNTS) {
          const res = await safeAwait(
            mirrorNodeService.getAccountInfo(acc, transaction.mirrorNetwork),
          );
          if (res.data) {
            const councilAccountInfo = parseAccountInfo(res.data);
            addUserPublicKeyIfRequired(councilAccountInfo.key);
          }
        }
      }
    }
  } catch (error) {
    console.error(error);
  }

  return userKeys.filter(userKey => userKeyIdsRequired.has(userKey.id));
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
