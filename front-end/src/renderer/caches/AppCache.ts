import { inject } from 'vue';
import { Transaction as SDKTransaction } from '@hiero-ledger/sdk';
import type { ConnectedOrganization } from '@renderer/types';
import type { SignatureAudit } from '@renderer/utils/transactionSignatureModels/transaction.model';
import { AccountByIdCache } from './mirrorNode/AccountByIdCache';
import { NodeByIdCache } from '@renderer/caches/mirrorNode/NodeByIdCache.ts';
import { PublicKeyOwnerCache } from '@renderer/caches/backend/PublicKeyOwnerCache.ts';
import { TransactionByIdCache } from '@renderer/caches/mirrorNode/TransactionByIdCache.ts';
import { BackendTransactionCache } from './backend/BackendTransactionCache.ts';
import { AccountByPublicKeyCache } from './mirrorNode/AccountByPublicKeyCache';
import TransactionFactory from '@renderer/utils/transactionSignatureModels/transaction-factory.ts';
import { createLogger } from '@renderer/utils';

export class AppCache {
  private static readonly injectKey = Symbol();
  public static instance = new AppCache();

  // Mirror node
  public readonly mirrorAccountById = new AccountByIdCache();
  public readonly mirrorAccountByPublicKey = new AccountByPublicKeyCache();
  public readonly mirrorNodeById = new NodeByIdCache();
  public readonly mirrorTransactionById = new TransactionByIdCache();

  // Backend
  public readonly backendTransaction = new BackendTransactionCache();
  public readonly backendPublicKeyOwner = new PublicKeyOwnerCache();

  //
  // Public
  //

  public static inject(): AppCache {
    return inject<AppCache>(AppCache.injectKey, this.instance);
  }

  public async computeSignatureKey(
    transaction: SDKTransaction,
    organization: ConnectedOrganization | null,
    mirrorNodeUrl: string,
  ): Promise<SignatureAudit> {
    const transactionModel = TransactionFactory.fromTransaction(transaction);

    return await transactionModel.computeSignatureKey(
      mirrorNodeUrl,
      this.mirrorAccountById,
      this.mirrorNodeById,
      this.backendPublicKeyOwner,
      organization,
    );
  }

  //
  // Protected
  //

  private static instanceCount = 0;

  private constructor() {
    AppCache.instanceCount += 1;
    if (AppCache.instanceCount >= 2) {
      const logger = createLogger('renderer.cache');
      logger.error(`${AppCache.instanceCount} instances of AppCache are created`);
    }
  }
}
