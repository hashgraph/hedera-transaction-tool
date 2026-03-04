import { AccountId, Key, PublicKey, Transaction as SDKTransaction } from '@hashgraph/sdk';

import { compareKeys } from '../sdk';
import type { INodeInfoParsed } from '@shared/interfaces';
import type { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache.ts';
import type { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import type { ConnectedOrganization } from '@renderer/types';
import { getPublicKeyOwner } from '@renderer/services/organization';
import { flattenKeyList } from '@renderer/services/keyPairService.ts';

export interface SignatureAudit {
  signatureKeys: Key[]; // All the keys expected to sign target transaction
  accountsKeys: Record<string, Key>; // All the account ids expected to sign target transaction
  receiverAccountsKeys: Record<string, Key>;
  newKeys: Key[];
  payerKey: Record<string, Key>; // Fee payer accounts (including transaction payer id)
  nodeAdminKeys: Record<number, Key>;
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

  getNodeId(): number | null {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getNodeAccountId(_nodeInfo: INodeInfoParsed): string | null {
    return null;
  }

  async computeSignatureKey(
    mirrorNodeLink: string,
    accountInfoCache: AccountByIdCache,
    nodeInfoCache: NodeByIdCache,
    organization: ConnectedOrganization | null,
    publicKeyOwnerCache?: Map<string, string | null>,
  ): Promise<SignatureAudit> {
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
    const externalKeys = new Set<PublicKey>();

    const currentKeyList: Key[] = [];
    const hasKey = (key: Key) => currentKeyList.some(existingKey => compareKeys(existingKey, key));

    /* Phase 1: Resolve all account lookups in parallel */
    const allAccountIds = new Set<string>();
    if (feePayerAccountId) allAccountIds.add(feePayerAccountId.toString());
    accounts.forEach(id => allAccountIds.add(id));
    receiverAccounts.forEach(id => allAccountIds.add(id));

    type AccountInfoResult = Awaited<ReturnType<typeof accountInfoCache.lookup>>;
    const accountInfoMap = new Map<string, AccountInfoResult | null>();

    const lookupResults = await Promise.allSettled(
      [...allAccountIds].map(async id => {
        const info = await accountInfoCache.lookup(id, mirrorNodeLink);
        return { id, info };
      }),
    );
    for (const result of lookupResults) {
      if (result.status === 'fulfilled') {
        accountInfoMap.set(result.value.id, result.value.info ?? null);
      }
    }

    // Also resolve node info in parallel if needed
    let nodeInfo: Awaited<ReturnType<typeof nodeInfoCache.lookup>> | null = null;
    let nodeAccountInfo: AccountInfoResult | null = null;
    if (!Number.isNaN(nodeId) && nodeId !== null) {
      try {
        nodeInfo = await nodeInfoCache.lookup(nodeId, mirrorNodeLink);
        const nodeAccountId = nodeInfo ? this.getNodeAccountId(nodeInfo) : null;
        if (nodeAccountId) {
          // This may already be in accountInfoMap if it was a signing/receiver account
          nodeAccountInfo = accountInfoMap.get(nodeAccountId) ??
            await accountInfoCache.lookup(nodeAccountId, mirrorNodeLink);
        }
      } catch (error) {
        console.log(`Node info lookup error for nodeId ${nodeId}:`, error);
      }
    }

    /* Phase 2: Build deduplicated signatureKeys list sequentially */
    if (feePayerAccountId) {
      const accountInfo = accountInfoMap.get(feePayerAccountId.toString());
      if (accountInfo?.key) {
        signatureKeys.push(accountInfo.key);
        payerKey[feePayerAccountId.toString()] = accountInfo.key;
        currentKeyList.push(accountInfo.key);
      }
    }

    for (const accountId of accounts) {
      const accountInfo = accountInfoMap.get(accountId);
      if (accountInfo?.key && !hasKey(accountInfo.key)) {
        signatureKeys.push(accountInfo.key);
        accountsKeys[accountId] = accountInfo.key;
        currentKeyList.push(accountInfo.key);
      }
    }

    for (const accountId of receiverAccounts) {
      const accountInfo = accountInfoMap.get(accountId);
      if (
        accountInfo?.receiverSignatureRequired &&
        accountInfo?.key &&
        !hasKey(accountInfo.key)
      ) {
        signatureKeys.push(accountInfo.key);
        receiverAccountsKeys[accountId] = accountInfo.key;
        currentKeyList.push(accountInfo.key);
      }
    }

    if (!Number.isNaN(nodeId) && nodeId !== null && nodeInfo) {
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
      if (nodeAccountInfo?.key && !hasKey(nodeAccountInfo.key)) {
        signatureKeys.push(nodeAccountInfo.key);
        nodeAdminKeys[nodeId] = nodeAccountInfo.key;
        currentKeyList.push(nodeAccountInfo.key);
      }
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
      const ownerCache = publicKeyOwnerCache ?? new Map<string, string | null>();
      // Pre-fetch all unique flat keys in parallel into the cache
      const allFlatKeysToCheck: { flatKey: PublicKey }[] = [];
      for (const key of signatureKeys) {
        for (const flatKey of flattenKeyList(key)) {
          allFlatKeysToCheck.push({ flatKey });
        }
      }
      const uniqueRawKeys = [...new Set(allFlatKeysToCheck.map(k => k.flatKey.toStringRaw()))];
      await Promise.allSettled(
        uniqueRawKeys
          .filter(rawKey => !ownerCache.has(rawKey))
          .map(async rawKey => {
            const owner = await getPublicKeyOwner(organization.serverUrl, rawKey);
            ownerCache.set(rawKey, owner);
          }),
      );

      // Classify using cached results (synchronous)
      for (const key of signatureKeys) {
        const flatKeys = flattenKeyList(key);
        for (const flatKey of flatKeys) {
          const rawKey = flatKey.toStringRaw();
          const owner = ownerCache.get(rawKey) ?? null;
          if (owner === null) {
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
      externalKeys,
      // nodeAccountKeys,
    };
  }
}
