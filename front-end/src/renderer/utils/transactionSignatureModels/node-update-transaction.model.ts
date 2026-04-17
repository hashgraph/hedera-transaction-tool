import { AccountId, Key, KeyList, NodeUpdateTransaction } from '@hiero-ledger/sdk';

import { TransactionBaseModel } from './transaction.model';
import type { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache';
import type { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache';
import { createLogger } from '@renderer/utils';

const logger = createLogger('renderer.transaction.signatureModel.nodeUpdate');

export default class NodeUpdateTransactionModel extends TransactionBaseModel<NodeUpdateTransaction> {
  override getNewKeys() {
    if (this.transaction.adminKey != null) {
      return [this.transaction.adminKey];
    }

    return [];
  }

  override async getNodeKeys(
    mirrorNodeLink: string,
    accountInfoCache: AccountByIdCache,
    nodeInfoCache: NodeByIdCache,
  ): Promise<{nodeId: number, key: Key} | null> {
    const nodeId = this.transaction.nodeId?.toNumber();

    try {
      if (nodeId == null || Number.isNaN(nodeId)) {
        return null;
      }

      const nodeInfo = await nodeInfoCache.lookup(nodeId, mirrorNodeLink);

      if (!nodeInfo) {
        logger.warn(`No node info found for node ${nodeId}`);
        return null;
      }

      if (!nodeInfo.admin_key) {
        logger.warn( `No admin key found for node ${nodeId}`);
        return null;
      }

      const isAccountIdChanging =
        this.transaction.accountId !== null &&
        nodeInfo.node_account_id !== null &&
        !this.transaction.accountId.equals(nodeInfo.node_account_id);

      if (!isAccountIdChanging) {
        // Case 1: account ID is not changing — admin key alone is sufficient
        return { nodeId, key: nodeInfo.admin_key};
      } else {
        // Cases 2 & 3: account ID is changing — determine if the current account
        // key must be explicitly included to satisfy the "current owner" requirement
        const shouldIncludeCurrentAccountKey = this.shouldIncludeAccountKey(this.transaction);

        if (shouldIncludeCurrentAccountKey) {
          // Case 3: account ID is the only change — build a 1-of-2 threshold so that
          // either the current account key OR the admin key can satisfy current owner
          const currentOwnerThreshold = new KeyList();
          currentOwnerThreshold.setThreshold(1);

          const currentAccountInfo = await accountInfoCache.lookup(nodeInfo.node_account_id!.toString(), mirrorNodeLink);

          if (currentAccountInfo?.key) {
            currentOwnerThreshold.push(currentAccountInfo.key);

            currentOwnerThreshold.push(nodeInfo.admin_key);

            return { nodeId, key: currentOwnerThreshold };
          } else {
            logger.warn(`No account key found for account ${nodeInfo.node_account_id!.toString()}`)
            return { nodeId, key: nodeInfo.admin_key };
          }
        } else {
          // Case 2: account ID is changing alongside other fields — admin key alone
          // satisfies the current owner requirement
          return { nodeId, key: nodeInfo.admin_key };
        }
      }
    } catch (error) {
      logger.warn('Failed to resolve node admin signing key', {
        error,
        nodeId,
      });
      throw error;
    }
  }

  override async getNewNodeAccountKeys(
    mirrorNodeLink: string,
    accountInfoCache: AccountByIdCache,
  ): Promise<{accountId: string, key: Key} | null> {
    const newAccountId = this.transaction.accountId;

    if (!newAccountId) {
      return null;
    }

    const isSwap = !newAccountId.equals(AccountId.fromString('0.0.0'));

    if (!isSwap) {
      return null;
    }

    const newAccountInfo = await accountInfoCache.lookup(newAccountId.toString(), mirrorNodeLink);
    if (newAccountInfo?.key) {
      return {
        accountId: newAccountId.toString(),
        key: newAccountInfo.key,
      };
    }

    return null;
  }

  private shouldIncludeAccountKey(tx: NodeUpdateTransaction): boolean {
    const hasOtherChanges =
      tx.adminKey !== null ||
      tx.description !== null ||
      tx.certificateHash !== null ||
      tx.gossipCaCertificate !== null ||
      (tx.serviceEndpoints !== null && tx.serviceEndpoints.length > 0) ||
      (tx.gossipEndpoints !== null && tx.gossipEndpoints.length > 0) ||
      tx.grpcWebProxyEndpoint !== null ||
      tx.declineReward !== null;

    return !hasOtherChanges;
  }
}
