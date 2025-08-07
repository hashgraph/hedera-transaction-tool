import { Key, KeyList, Transaction as SDKTransaction } from '@hashgraph/sdk';

import {
  MirrorNodeService,
  NodeInfoParsed,
  parseAccountInfo,
  parseNodeInfo
} from '@app/common';

export abstract class TransactionBaseModel<T extends SDKTransaction> {
  constructor(protected readonly transaction: T) {}

  toBytes(): Uint8Array {
    return this.transaction.toBytes();
  }

  toBytesAsync(): Promise<Uint8Array> {
    return this.transaction.toBytesAsync();
  }

  getSigningAccounts(): Set<string> {
    const payerId = this.transaction.transactionId?.accountId;
    if (payerId) {
      return new Set<string>([payerId.toString()]);
    }
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

  getNodeAccountId(nodeInfo: NodeInfoParsed): string | null {
    return null;
  }

  async computeSignatureKey(
    mirrorNodeService: MirrorNodeService,
    mirrorNetwork: string,
  ): Promise<KeyList> {
    const accounts = this.getSigningAccounts();
    const receiverAccounts = this.getReceiverAccounts();
    const newKeys = this.getNewKeys() ?? [];
    const nodeId = this.getNodeId();

    /* Create a new key list */
    const signatureKey = new KeyList();

    /* Add keys to the signature key list */
    signatureKey.push(...newKeys);

    /* Get the keys of the account ids to the signature key list */
    for (const accountId of accounts) {
      try {
        const accountInfo = parseAccountInfo(
          await mirrorNodeService.getAccountInfo(accountId, mirrorNetwork),
        );
        if (!accountInfo.key) continue;
        signatureKey.push(accountInfo.key);
      } catch (error) {
        console.log(error);
      }
    }

    /* Check if there are a receiver accounts that require signature, if so add them */
    for (const accountId of receiverAccounts) {
      try {
        const accountInfo = parseAccountInfo(
          await mirrorNodeService.getAccountInfo(accountId, mirrorNetwork),
        );
        if (!accountInfo.receiverSignatureRequired || !accountInfo.key) continue;
        signatureKey.push(accountInfo.key);
      } catch (error) {
        console.log(error);
      }
    }

    /* Check if user has a key included in the node admin key */
    try {
      if (!Number.isNaN(nodeId) && nodeId !== null) {
        const nodeInfo = parseNodeInfo(await mirrorNodeService.getNodeInfo(nodeId, mirrorNetwork));

        if (nodeInfo.admin_key) {
          signatureKey.push(nodeInfo.admin_key);
        }

        //TODO documentation on this requirement is still in the works.
        //Current documentation states that when the node account id is unset, it can be signed by
        //the account key OR the node admin key. Which means I would need to put these in an keyList with
        //a threshold before added them to the signature keys.
        //In the case of account id being changed, both the old key and the new key are required
        // to sign the transaction. So they can be added like this.
        const nodeAccountId = this.getNodeAccountId(nodeInfo);
        if (nodeAccountId) {
          const { key } = parseAccountInfo(
            await mirrorNodeService.getAccountInfo(nodeAccountId, mirrorNetwork)
          );
          if (key) {
            signatureKey.push(key);
          }
        }
      }
    } catch (error) {
      console.log(error);
    }

    return signatureKey;
  }
}
