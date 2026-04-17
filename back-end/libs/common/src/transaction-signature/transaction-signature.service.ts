import { Injectable, Logger } from '@nestjs/common';
import {
  AccountId,
  Key,
  KeyList,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  Transaction as SDKTransaction,
} from '@hiero-ledger/sdk';
import { Transaction } from '@entities';
import TransactionFactory from '@app/common/transaction-signature/model/transaction-factory';
import { TransactionBaseModel } from '@app/common/transaction-signature/model/transaction-base.model';
import { AccountCacheService } from '@app/common/transaction-signature/account-cache.service';
import { NodeCacheService } from '@app/common/transaction-signature/node-cache.service';
import { COUNCIL_ACCOUNTS } from '@app/common/constants';

export interface SignatureRequirements {
  feePayerAccount: string;
  signingAccounts: Set<string>;
  receiverAccounts: Set<string>;
  newKeys: Key[];
  nodeId: number | null;
}

@Injectable()
export class TransactionSignatureService {
  private readonly logger = new Logger(TransactionSignatureService.name);

  constructor(
    private readonly accountCacheService: AccountCacheService,
    private readonly nodeCacheService: NodeCacheService,
  ) {}

  /**
   * Compute all required signature keys for a transaction
   * This is the main entry point that replaces the old computeSignatureKey
   */
  async computeSignatureKey(
    transaction: Transaction,
    showAll: boolean = false,
  ): Promise<KeyList> {
    const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);
    const transactionModel = TransactionFactory.fromTransaction(sdkTransaction);

    // Extract signature requirements from the transaction model
    const requirements = this.extractSignatureRequirements(transactionModel);

    // Build the key list
    const signatureKey = new KeyList();

    await this.addFeePayerKey(signatureKey, transaction, requirements.feePayerAccount);
    await this.addSigningAccountKeys(signatureKey, transaction, requirements.signingAccounts);
    await this.addReceiverAccountKeys(signatureKey, transaction, requirements.receiverAccounts, showAll);

    if (requirements.nodeId) {
      await this.addNodeKeys(signatureKey, transaction, requirements.nodeId);
    }

    signatureKey.push(...requirements.newKeys);

    return signatureKey;
  }

  /**
   * Extract all signature requirements from a transaction model
   */
  private extractSignatureRequirements(
    transactionModel: TransactionBaseModel<any>
  ): SignatureRequirements {
    return {
      feePayerAccount: transactionModel.getFeePayerAccountId().toString(),
      signingAccounts: transactionModel.getSigningAccounts(),
      receiverAccounts: transactionModel.getReceiverAccounts(),
      newKeys: transactionModel.getNewKeys() ?? [],
      nodeId: transactionModel.getNodeId(),
    };
  }

  /**
   * Get fee payer's key
   */
  private async addFeePayerKey(
    signatureKey: KeyList,
    transaction: Transaction,
    feePayerAccount: string
  ): Promise<void> {
    try {
      const accountInfo = await this.accountCacheService.getAccountInfoForTransaction(
        transaction,
        feePayerAccount,
      );
      if (accountInfo?.key) {
        signatureKey.push(accountInfo.key);
      }
    } catch (error) {
      this.logger.error(`Failed to get fee payer key: ${error.message}`);
      return null;
    }
  }

  /**
   * Get keys for signing accounts
   */
  private async addSigningAccountKeys(
    signatureKey: KeyList,
    transaction: Transaction,
    signingAccounts: Set<string>
  ): Promise<void> {
    for (const account of signingAccounts) {
      try {
        const accountInfo = await this.accountCacheService.getAccountInfoForTransaction(
          transaction,
          account,
        );
        if (accountInfo?.key) {
          signatureKey.push(accountInfo.key);
        }
      } catch (error) {
        this.logger.error(`Failed to get key for account ${account}: ${error.message}`);
      }
    }
  }

  /**
   * Get keys for receiver accounts (only if receiverSignatureRequired)
   */
  private async addReceiverAccountKeys(
    signatureKey: KeyList,
    transaction: Transaction,
    receiverAccounts: Set<string>,
    showAll: boolean,
  ): Promise<void> {
    for (const account of receiverAccounts) {
      try {
        const accountInfo = await this.accountCacheService.getAccountInfoForTransaction(
          transaction,
          account,
          true,
        );
        if (accountInfo?.key && (showAll || accountInfo.receiverSignatureRequired)) {
          signatureKey.push(accountInfo.key);
        }
      } catch (error) {
        this.logger.error(`Failed to get receiver key for account ${account}: ${error.message}`);
      }
    }
  }

  /**
   * Resolves and adds the required signing keys for a node transaction to the provided KeyList.
   *
   * For NodeDeleteTransactions, the node admin key is only required if the fee payer is not a council account
   *
   * For NodeUpdateTransactions, HIP-1299 defines three cases based on what is changing:
   *
   *   Case 1 — accountId is NOT changing (or only other fields are changing):
   *     Required: admin key only
   *     The current account key is not needed.
   *
   *   Case 2 — accountId IS changing AND other fields are also changing:
   *     Required: admin key + new account key (if swap)
   *     Admin key alone satisfies the "current owner" requirement, so the
   *     current account key does not need to be explicitly included.
   *
   *   Case 3 — accountId IS changing AND it is the ONLY change:
   *     Required: (current account key OR admin key) + new account key (if swap)
   *     Since no other fields provide admin key context, the current account key
   *     must be explicitly included alongside the admin key as a 1-of-2 threshold.
   *
   * Additionally, if the accountId is being swapped to a new (non-zero) account,
   * that new account's key must always co-sign regardless of which case applies.
   * Setting accountId to 0.0.0 is a removal — no new account key is required.
   */
  private async addNodeKeys(
    signatureKey: KeyList,
    transaction: Transaction,
    nodeId: number,
  ): Promise<void> {
    try {
      const nodeInfo = await this.nodeCacheService.getNodeInfoForTransaction(transaction, nodeId);

      if (!nodeInfo) {
        this.logger.warn(`No node info found for node ${nodeId}`);
        return;
      }

      if (!nodeInfo.admin_key) {
        this.logger.warn(`No node admin key found for node ${nodeId}`);
        return;
      }

      const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

      if (sdkTransaction instanceof NodeDeleteTransaction) {
        // if fee payer is council_accounts,
        // it will already be added to the required list
        // and the admin key is not required (as the fee payer will already approve it)
        // otherwise, admin key is required
        const payerId = sdkTransaction.transactionId?.accountId;
        const isCouncilAccount = payerId && payerId.toString() in COUNCIL_ACCOUNTS;

        if (!isCouncilAccount) {
          signatureKey.push(nodeInfo.admin_key);
        }
        return;
      } else if (!(sdkTransaction instanceof NodeUpdateTransaction)) {
        // Non-update transactions only require the admin key
        signatureKey.push(nodeInfo.admin_key);
        return;
      }

      const nodeUpdateTx = sdkTransaction as NodeUpdateTransaction;

      const isAccountIdChanging =
        nodeUpdateTx.accountId !== null &&
        nodeInfo.node_account_id !== null &&
        !nodeUpdateTx.accountId.equals(nodeInfo.node_account_id);

      if (!isAccountIdChanging) {
        // Case 1: account ID is not changing — admin key alone is sufficient
        signatureKey.push(nodeInfo.admin_key);
      } else {
        // Cases 2 & 3: account ID is changing — determine if the current account
        // key must be explicitly included to satisfy the "current owner" requirement
        const shouldIncludeCurrentAccountKey = this.shouldIncludeAccountKey(nodeUpdateTx);

        if (shouldIncludeCurrentAccountKey) {
          // Case 3: account ID is the only change — build a 1-of-2 threshold so that
          // either the current account key OR the admin key can satisfy current owner
          const currentOwnerThreshold = new KeyList();
          currentOwnerThreshold.setThreshold(1);

          if (nodeInfo.node_account_id === null) {
            this.logger.warn(`No node account ID found for node ${nodeId}`);
            signatureKey.push(nodeInfo.admin_key);
            return;
          }

          const currentAccountInfo = await this.accountCacheService.getAccountInfoForTransaction(
            transaction,
            nodeInfo.node_account_id.toString(),
          );
          if (currentAccountInfo?.key) {
            currentOwnerThreshold.push(currentAccountInfo.key);
          }
          currentOwnerThreshold.push(nodeInfo.admin_key);

          signatureKey.push(currentOwnerThreshold);
        } else {
          // Case 2: account ID is changing alongside other fields — admin key alone
          // satisfies the current owner requirement
          signatureKey.push(nodeInfo.admin_key);
        }

        // If this is a swap (not a removal), the new account must also co-sign.
        // Setting accountId to 0.0.0 is a removal — there is no new account to sign.
        const newAccountId = nodeUpdateTx.accountId;
        const isSwap = !newAccountId.equals(AccountId.fromString('0.0.0'));
        if (isSwap) {
          const newAccountInfo = await this.accountCacheService.getAccountInfoForTransaction(
            transaction,
            newAccountId.toString(),
          );
          if (newAccountInfo?.key) {
            signatureKey.push(newAccountInfo.key);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get node keys for node ${nodeId}: ${error.message}`);
    }
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
