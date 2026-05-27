import { Key, RegisteredNodeUpdateTransaction } from '@hiero-ledger/sdk';

import { TransactionBaseModel } from './transaction.model';
import type { AccountByIdCache } from '@renderer/caches/mirrorNode/AccountByIdCache';
import type { RegisteredNodeByIdCache } from '@renderer/caches/mirrorNode/RegisteredNodeByIdCache';
import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.transaction.signatureModel.registerNodeDelete');

export default class RegisteredNodeUpdateTransactionModel extends TransactionBaseModel<RegisteredNodeUpdateTransaction> {
  override async getRegisteredNodeKeys(
    mirrorNodeLink: string,
    _accountInfoCache: AccountByIdCache,
    registeredNodeInfoCache: RegisteredNodeByIdCache,
  ): Promise<{ registeredNodeId: number; key: Key } | null> {
    const registeredNodeId = this.transaction.registeredNodeId?.toNumber() ?? null;

    try {
      if (registeredNodeId == null) {
        return null;
      }

      const registeredNodeInfo = await registeredNodeInfoCache.lookup(
        registeredNodeId,
        mirrorNodeLink,
      );

      if (registeredNodeInfo === null) {
        logger.warn(`No node info found for node ${registeredNodeId}`);
        return null;
      }

      if (registeredNodeInfo.admin_key === null) {
        logger.warn(`No admin key found for node ${registeredNodeId}`);
        return null;
      }

      return { registeredNodeId, key: registeredNodeInfo.admin_key };
    } catch (error) {
      logger.warn('Failed to resolve node admin signing key', {
        error,
        registeredNodeId,
      });
      throw error;
    }
  }
}
