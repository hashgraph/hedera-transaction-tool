import { Key, NodeDeleteTransaction } from '@hiero-ledger/sdk';

import { TransactionBaseModel } from './transaction.model';
import { COUNCIL_ACCOUNTS } from './index';
import type { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache';
import type { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache';
import { createLogger } from '@renderer/utils';

const logger = createLogger('renderer.transaction.signatureModel.nodeDelete');

export default class NodeDeleteTransactionModel extends TransactionBaseModel<NodeDeleteTransaction> {
  override async getNodeKeys(
    mirrorNodeLink: string,
    _accountInfoCache: AccountByIdCache,
    nodeInfoCache: NodeByIdCache,
  ): Promise<{nodeId: number, key: Key} | null> {
    // if fee payer is council_accounts,
    // it will already be added to the required list
    // and the admin key is not required (as the fee payer will already approve it)
    // otherwise, admin key is required
    const payerId = this.transaction.transactionId?.accountId;
    const isCouncilAccount = payerId && payerId.toString() in COUNCIL_ACCOUNTS;

    if (isCouncilAccount) {
      return null;
    }

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

      return { nodeId, key: nodeInfo.admin_key };
    } catch (error) {
      logger.warn('Failed to resolve node admin signing key', {
        error,
        nodeId,
      });
      throw error;
    }
  }
}
