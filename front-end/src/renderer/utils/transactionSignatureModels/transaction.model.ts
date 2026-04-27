import { AccountId, Key, PublicKey, Transaction as SDKTransaction } from '@hiero-ledger/sdk';

import { compareKeys } from '../sdk';
import type { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import type { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import type { ConnectedOrganization } from '@renderer/types';
import type { PublicKeyOwnerCache } from '@renderer/caches/backend/PublicKeyOwnerCache.ts';
import { flattenKeyList } from '@renderer/services/keyPairService.ts';
import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.transaction.signatureModel');

export interface SignatureAudit {
  signatureKeys: Key[]; // All the keys expected to sign target transaction
  accountsKeys: Record<string, Key>; // All the account ids expected to sign target transaction
  receiverAccountsKeys: Record<string, Key>;
  newKeys: Key[];
  payerKey: Record<string, Key>; // Fee payer accounts (including transaction payer id)
  nodeAdminKeys: Record<number, Key>;
  newNodeAccountKeys: Record<string, Key>;
  externalKeys: Set<PublicKey>; // External keys (no matching user in backend)
}

export abstract class TransactionBaseModel<T extends SDKTransaction> {
  constructor(protected transaction: T) {}

  toBytes(): Uint8Array {
    return this.transaction.toBytes();
  }

  getFeePayerAccountId(): AccountId | null {
    return this.transaction.transactionId?.accountId ?? null;
  }

  getSigningAccounts(): Set<string> {
    return new Set<string>();
  }

  getReceiverAccounts(): Set<string> {
    return new Set<string>();
  }

  getNewKeys(): Key[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getNodeKeys(
    _mirrorNodeLink: string,
    _accountInfoCache: AccountByIdCache,
    _nodeInfoCache: NodeByIdCache,
  ): Promise<{nodeId: number, key: Key} | null> {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getNewNodeAccountKeys(
    _mirrorNodeLink: string,
    _accountInfoCache: AccountByIdCache,
  ): Promise<{accountId: string, key: Key} | null> {
    return null;
  }

  async computeSignatureKey(
    mirrorNodeLink: string,
    accountInfoCache: AccountByIdCache,
    nodeInfoCache: NodeByIdCache,
    publicKeyOwnerCache: PublicKeyOwnerCache,
    organization: ConnectedOrganization | null,
  ): Promise<SignatureAudit> {
    const feePayerAccountId = this.getFeePayerAccountId();
    const accounts = this.getSigningAccounts();
    const receiverAccounts = this.getReceiverAccounts();
    const newKeys = this.getNewKeys() ?? [];
    const nodeKeys = await this.getNodeKeys(mirrorNodeLink, accountInfoCache, nodeInfoCache);
    const newNodeKeys = await this.getNewNodeAccountKeys(mirrorNodeLink, accountInfoCache);

    /* Create result objects */
    const signatureKeys: Key[] = [];
    const accountsKeys: Record<string, Key> = {};
    const payerKey: Record<string, Key> = {};
    const receiverAccountsKeys: Record<string, Key> = {};
    const nodeAdminKeys: Record<number, Key> = {};
    const newNodeAccountKeys: Record<string, Key> = {};
    const externalKeys = new Set<PublicKey>();

    const currentKeyList: Key[] = [];
    const hasKey = (key: Key) => currentKeyList.some(existingKey => compareKeys(existingKey, key));

    if (feePayerAccountId) {
      try {
        const accountInfo = await accountInfoCache.lookup(
          feePayerAccountId.toString(),
          mirrorNodeLink,
        );
        if (accountInfo?.key) {
          signatureKeys.push(accountInfo.key);
          payerKey[feePayerAccountId.toString()] = accountInfo.key;
          currentKeyList.push(accountInfo.key);
        }
      } catch (error) {
        logger.warn('Failed to resolve fee payer key', {
          error,
        });
        throw error;
      }
    }

    /* Get the keys of the account ids to the signature key list */
    for (const accountId of accounts) {
      try {
        const accountInfo = await accountInfoCache.lookup(accountId, mirrorNodeLink);
        if (accountInfo?.key && !hasKey(accountInfo.key)) {
          signatureKeys.push(accountInfo.key);
          accountsKeys[accountId] = accountInfo.key;
          currentKeyList.push(accountInfo.key);
        }
      } catch (error) {
        logger.warn('Failed to resolve account signing key', {
          accountId,
          error,
        });
        throw error;
      }
    }

    /* Check if there are a receiver accounts that require signature, if so add them */
    for (const accountId of receiverAccounts) {
      try {
        const accountInfo = await accountInfoCache.lookup(accountId, mirrorNodeLink);
        if (
          accountInfo?.receiverSignatureRequired &&
          accountInfo?.key &&
          !hasKey(accountInfo.key)
        ) {
          signatureKeys.push(accountInfo.key);
          receiverAccountsKeys[accountId] = accountInfo.key;
          currentKeyList.push(accountInfo.key);
        }
      } catch (error) {
        logger.warn('Failed to resolve receiver account signing key', {
          accountId,
          error,
        });
        throw error;
      }
    }

    if (nodeKeys) {
      const { nodeId, key } = nodeKeys;
      signatureKeys.push(key);
      nodeAdminKeys[nodeId] = key;
      currentKeyList.push(key);
    }

    if (newNodeKeys) {
      const { accountId, key } = newNodeKeys;
      signatureKeys.push(key);
      newNodeAccountKeys[accountId] = key;
      currentKeyList.push(key);
    }

    /* Add keys to the signature key list */
    for (const key of newKeys) {
      if (key && !hasKey(key)) {
        signatureKeys.push(key);
        currentKeyList.push(key);
      }
    }

    // Collects external keys: those one have no matching user in backend
    if (organization !== null) {
      for (const key of signatureKeys) {
        const flatKeys = flattenKeyList(key);
        for (const flatKey of flatKeys) {
          const o = await publicKeyOwnerCache.lookup(flatKey.toStringRaw(), organization.serverUrl);
          if (o === null) {
            // flatKey has no matching user in organization
            // => flatKey is external
            externalKeys.add(flatKey);
            break;
          }
        }
      }
    }

    return {
      signatureKeys,
      accountsKeys,
      receiverAccountsKeys,
      newKeys,
      payerKey,
      nodeAdminKeys,
      newNodeAccountKeys,
      externalKeys,
    };
  }
}
