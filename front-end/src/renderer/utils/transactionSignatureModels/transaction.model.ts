import { AccountId, Key, Transaction as SDKTransaction } from '@hashgraph/sdk';

import { getNodeInfo } from '@renderer/services/mirrorNodeDataService';
import { compareKeys } from '../sdk';
import type { INodeInfoParsed } from '@shared/interfaces';
import type { AccountInfoCache } from '@renderer/utils/accountInfoCache.ts';

export abstract class TransactionBaseModel<T extends SDKTransaction> {
  constructor(protected transaction: T) {}

  toBytes(): Uint8Array {
    return this.transaction.toBytes();
  }

  toBytesAsync(): Promise<Uint8Array> {
    return this.transaction.toBytesAsync();
  }

  getFeePayerAccountId(): AccountId | null {
    const payerId = this.transaction.transactionId?.accountId;
    if (payerId) {
      return payerId;
    }
    return null;
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

  getNodeId(): number | null {
    return null;
  }

  getNodeAccountId(nodeInfo: INodeInfoParsed): string | null {
    // eslint-disable-line @typescript-eslint/no-unused-vars
    return null;
  }

  async computeSignatureKey(mirrorNodeLink: string, accountInfoCache: AccountInfoCache) {
    const feePayerAccountId = this.getFeePayerAccountId();
    const accounts = this.getSigningAccounts();
    const receiverAccounts = this.getReceiverAccounts();
    const newKeys = this.getNewKeys() ?? [];
    const nodeId = this.getNodeId();

    /* Create result objects */
    const signatureKeys: Key[] = [];
    const accountsKeys: Record<string, Key> = {};
    const payerKey: Record<string, Key> = {};
    const receiverAccountsKeys: Record<string, Key> = {};
    const nodeAdminKeys: Record<number, Key> = {};

    const currentKeyList: Key[] = [];
    const hasKey = (key: Key) => currentKeyList.some(existingKey => compareKeys(existingKey, key));

    if (feePayerAccountId) {
      try {
        const accountInfo = await accountInfoCache.fetch(
          feePayerAccountId.toString(),
          mirrorNodeLink,
        );
        if (accountInfo.key) {
          signatureKeys.push(accountInfo.key);
          payerKey[feePayerAccountId] = accountInfo.key;
          currentKeyList.push(accountInfo.key);
        }
      } catch (error) {
        console.log(`Fee payer key error:`, error);
      }
    }

    /* Get the keys of the account ids to the signature key list */
    for (const accountId of accounts) {
      try {
        const accountInfo = await accountInfoCache.fetch(accountId, mirrorNodeLink);
        if (accountInfo.key && !hasKey(accountInfo.key)) {
          signatureKeys.push(accountInfo.key);
          accountsKeys[accountId] = accountInfo.key;
          currentKeyList.push(accountInfo.key);
        }
      } catch (error) {
        console.log(`Account key error for ${accountId}:`, error);
      }
    }

    /* Check if there are a receiver accounts that require signature, if so add them */
    for (const accountId of receiverAccounts) {
      try {
        const accountInfo = await accountInfoCache.fetch(accountId, mirrorNodeLink);
        if (
          accountInfo.receiverSignatureRequired &&
          accountInfo.key &&
          !hasKey(accountInfo.key)
        ) {
          signatureKeys.push(accountInfo.key);
          receiverAccountsKeys[accountId] = accountInfo.key;
          currentKeyList.push(accountInfo.key);
        }
      } catch (error) {
        console.log(`Receiver account key error for ${accountId}:`, error);
      }
    }

    /* Check if user has a key included in the node admin key */
    try {
      if (!Number.isNaN(nodeId) && nodeId !== null) {
        const nodeInfo = await getNodeInfo(nodeId, mirrorNodeLink);
        const adminKey = nodeInfo.admin_key;
        if (adminKey && !hasKey(adminKey)) {
          signatureKeys.push(adminKey);
          nodeAdminKeys[nodeId] = adminKey;
          currentKeyList.push(adminKey);
        }

        //TODO documentation on this requirement is still in the works.
        //Current documentation states that when the node account id is unset, it can be signed by
        //the account key OR the node admin key. Which means I would need to put these in an keyList with
        //a threshold before added them to the signature keys.
        //In the case of account id being changed, both the old key and the new key are required
        // to sign the transaction. So they can be added like this.
        //NOTE: this is different than node adminKey
        const nodeAccountId = this.getNodeAccountId(nodeInfo);
        if (nodeAccountId) {
          const { key } = await accountInfoCache.fetch(
            nodeAccountId,
            mirrorNodeLink,
          );
          if (key && !hasKey(key)) {
            signatureKeys.push(key);
            nodeAdminKeys[nodeId] = key;
            currentKeyList.push(key);
          }
        }
      }
    } catch (error) {
      console.log(`Node admin key error for nodeId ${nodeId}:`, error);
    }

    /* Add keys to the signature key list */
    for (const key of newKeys) {
      if (key && !hasKey(key)) {
        signatureKeys.push(key);
        currentKeyList.push(key);
      }
    }

    return {
      signatureKeys,
      accountsKeys,
      receiverAccountsKeys,
      newKeys,
      payerKey,
      nodeAdminKeys,
      // nodeAccountKeys,
    };
  }
}
