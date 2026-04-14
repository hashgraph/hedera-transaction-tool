import { inject, provide } from 'vue';
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

export class AppCache {
  private static readonly injectKey = Symbol();

  //
  // Public
  //

  public static provide(appCache: AppCache): void {
    provide(AppCache.injectKey, appCache);
  }

  public static inject(): AppCache {
    const defaultFactory = () =>
      new AppCache(
        new AccountByIdCache(),
        new AccountByPublicKeyCache(),
        new NodeByIdCache(),
        new TransactionByIdCache(),
        new BackendTransactionCache(),
        new PublicKeyOwnerCache(),
      );
    return inject<AppCache>(AppCache.injectKey, defaultFactory, true);
  }

  public constructor(
    // Mirror node
    public readonly mirrorAccountById: AccountByIdCache,
    public readonly mirrorAccountByPublicKey: AccountByPublicKeyCache,
    public readonly mirrorNode: NodeByIdCache,
    public readonly mirrorTransaction: TransactionByIdCache,
    // Backend
    public readonly backendTransaction: BackendTransactionCache,
    public readonly backendPublicKeyOwner: PublicKeyOwnerCache,
  ) {}

  public async computeSignatureKey(
    transaction: SDKTransaction,
    organization: ConnectedOrganization | null,
    mirrorNodeUrl: string,
  ): Promise<SignatureAudit> {
    const transactionModel = TransactionFactory.fromTransaction(transaction);

    return await transactionModel.computeSignatureKey(
      mirrorNodeUrl,
      this.mirrorAccountById,
      this.mirrorNode,
      this.backendPublicKeyOwner,
      organization,
    );
  }
}
