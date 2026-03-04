import { Injectable, Logger } from '@nestjs/common';
import { Key, KeyList, Transaction as SDKTransaction } from '@hashgraph/sdk';
import { Transaction } from '@entities';
import TransactionFactory from '@app/common/transaction-signature/model/transaction-factory';
import { TransactionBaseModel } from '@app/common/transaction-signature/model/transaction-base.model';
import { AccountCacheService } from '@app/common/transaction-signature/account-cache.service';
import { NodeCacheService } from '@app/common/transaction-signature/node-cache.service';

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

    // Build the key list — gather keys in parallel, then merge
    const signatureKey = new KeyList();

    const feePayerKeys = new KeyList();
    const signingKeys = new KeyList();
    const receiverKeys = new KeyList();
    const nodeKeys = new KeyList();

    await Promise.all([
      this.addFeePayerKey(feePayerKeys, transaction, requirements.feePayerAccount),
      this.addSigningAccountKeys(signingKeys, transaction, requirements.signingAccounts),
      this.addReceiverAccountKeys(receiverKeys, transaction, requirements.receiverAccounts, showAll),
      requirements.nodeId
        ? this.addNodeKeys(nodeKeys, transaction, requirements.nodeId)
        : Promise.resolve(),
    ]);

    signatureKey.push(...feePayerKeys, ...signingKeys, ...receiverKeys, ...nodeKeys, ...requirements.newKeys);

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
    const results = await Promise.allSettled(
      [...signingAccounts].map(account =>
        this.accountCacheService.getAccountInfoForTransaction(transaction, account),
      ),
    );
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.key) {
        signatureKey.push(result.value.key);
      } else if (result.status === 'rejected') {
        this.logger.error(`Failed to get key for signing account: ${result.reason?.message}`);
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
    const results = await Promise.allSettled(
      [...receiverAccounts].map(account =>
        this.accountCacheService.getAccountInfoForTransaction(transaction, account),
      ),
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const accountInfo = result.value;
        if ((showAll || accountInfo?.receiverSignatureRequired) && accountInfo?.key) {
          signatureKey.push(accountInfo.key);
        }
      } else if (result.status === 'rejected') {
        this.logger.error(`Failed to get receiver key: ${result.reason?.message}`);
      }
    }
  }

  /**
   * Get node admin key and optionally node account key
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

      // Add node admin key
      if (nodeInfo.admin_key) {
        signatureKey.push(nodeInfo.admin_key);
      }

      //TODO documentation on this requirement is still in the works.
      //Current documentation states that when the node account id is unset, it can be signed by
      //the account key OR the node admin key. Which means I would need to put these in an keyList with
      //a threshold before added them to the signature keys.
      //In the case of account id being changed, both the old key and the new key are required
      // to sign the transaction. So they can be added like this.
      //NOTE: this is different than node adminKey
      const nodeAccount = nodeInfo.node_account_id.toString();
      if (nodeAccount) {
        const accountInfo = await this.accountCacheService.getAccountInfoForTransaction(
          transaction,
          nodeAccount,
        );
        if (accountInfo?.key) {
          signatureKey.push(accountInfo.key);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get node keys for node ${nodeId}: ${error.message}`);
    }
  }
}
