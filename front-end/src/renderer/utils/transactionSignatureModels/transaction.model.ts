import { Key, Transaction as SDKTransaction } from '@hashgraph/sdk';

import { getAccountInfo, getNodeKeys } from '@renderer/services/mirrorNodeDataService';
import { compareKeys } from '../sdk';

export abstract class TransactionBaseModel<T extends SDKTransaction> {
  constructor(protected transaction: T) {}

  toBytes(): Uint8Array {
    return this.transaction.toBytes();
  }

  toBytesAsync(): Promise<Uint8Array> {
    return this.transaction.toBytesAsync();
  }

  getFeePayerAccountId(): string | null {
    const payerId = this.transaction.transactionId?.accountId;
    if (payerId) {
      return payerId.toString();
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

  async computeSignatureKey(
    mirrorNodeLink: string,
  ) {
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
    // const nodeAccountKeys: Record<string, Key> = {};

    const currentKeyList: Key[] = [];
    const hasKey = (key: Key) => currentKeyList.some(existingKey => compareKeys(existingKey, key));

    if (feePayerAccountId) {
      try {
        const accountInfo = await getAccountInfo(feePayerAccountId, mirrorNodeLink);
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
        const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
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
        const accountInfo = await getAccountInfo(accountId, mirrorNodeLink);
        if (accountInfo.receiverSignatureRequired && accountInfo.key && !hasKey(accountInfo.key)) {
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
        const {
          adminKey,
          nodeAccountId,
          nodeAccountKey,
          signatureKey
        } = await getNodeKeys(
          nodeId,
          transaction,
          mirrorNodeLink,
        );

        if (adminKey && !hasKey(adminKey)) {
          signatureKey.push(adminKey);
          nodeAdminKeys[nodeId] = adminKey
          currentKeyList.push(adminKey);
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
