import { ClientProxy } from '@nestjs/microservices';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { MurLock } from 'murlock';
import {
  AccountUpdateTransaction,
  NodeUpdateTransaction,
  Transaction as SDKTransaction,
  Status,
} from '@hashgraph/sdk';

import { Transaction, TransactionStatus } from '@entities';

import {
  computeSignatureKey,
  ExecuteTransactionDto,
  ExecuteTransactionGroupDto,
  getClientFromNetwork,
  getStatusCodeFromMessage,
  hasValidSignatureKey,
  MirrorNodeService,
  NOTIFICATIONS_SERVICE,
  notifyTransactionAction,
  TransactionExecutedDto,
  TransactionGroupExecutedDto,
  notifySyncIndicators,
  sleep,
  transactionIs,
} from '@app/common';

@Injectable()
export class ExecuteService {
  constructor(
    @InjectRepository(Transaction) private transactionsRepo: Repository<Transaction>,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
    private readonly mirrorNodeService: MirrorNodeService,
  ) {}

  /* Tries to execute a transaction */
  @MurLock(15000, 'transaction.id')
  async executeTransaction(transaction: ExecuteTransactionDto) {
    /* Gets the SDK transaction */
    const sdkTransaction = await this.getValidatedSDKTransaction(transaction);
    return this._executeTransaction(transaction, sdkTransaction);
  }

  @MurLock(15000, 'transactionGroup.id + "_group"')
  async executeTransactionGroup(transactionGroup: ExecuteTransactionGroupDto) {
    const transactions: { sdkTransaction: SDKTransaction; transaction: ExecuteTransactionDto }[] =
      [];
    // first we need to validate all the transactions, as they all need to be valid before we can execute any of them
    for (const groupItemDto of transactionGroup.groupItems) {
      const transaction = groupItemDto.transaction;
      try {
        const sdkTransaction = await this.getValidatedSDKTransaction(transaction);
        transactions.push({ sdkTransaction, transaction });
      } catch (error) {
        throw new Error(
          `Transaction Group cannot be submitted. Error validating transaction ${transaction.id}: ${error.message}`,
        );
      }
    }

    const results: TransactionGroupExecutedDto = {
      transactions: [],
    };

    // now we can execute all the transactions
    if (transactionGroup.sequential) {
      for (const { sdkTransaction, transaction } of transactions) {
        const delay = transaction.validStart.getTime() - Date.now();
        await sleep(delay);
        results.transactions.push(await this._executeTransaction(transaction, sdkTransaction));
      }
    } else {
      const executionPromises = transactions.map(async ({ sdkTransaction, transaction }) => {
        const delay = transaction.validStart.getTime() - Date.now();
        await sleep(delay);
        return this._executeTransaction(transaction, sdkTransaction);
      });
      results.transactions.push(...(await Promise.all(executionPromises)));
    }

    return results;
  }

  private async _executeTransaction(
    transaction: ExecuteTransactionDto,
    sdkTransaction: SDKTransaction,
  ) {
    /* Execute the transaction */
    const client = await getClientFromNetwork(transaction.mirrorNetwork);

    const executedAt = new Date();
    let transactionStatus = TransactionStatus.EXECUTED;
    let transactionStatusCode = 21;

    const result: TransactionExecutedDto = {
      status: transactionStatus,
    };

    try {
      const response = await sdkTransaction.execute(client);
      const receipt = await response.getReceipt(client);

      result.response = JSON.stringify(response.toJSON());
      result.receipt = JSON.stringify(receipt.toJSON());
      result.receiptBytes = Buffer.from(receipt.toBytes());
      transactionStatusCode = receipt.status._code || Status.Ok._code;
    } catch (error) {
      transactionStatusCode = error.status?._code || 21;
      if (!error.status) transactionStatusCode = getStatusCodeFromMessage(error.message);
      transactionStatus = TransactionStatus.FAILED;
      result.error = error.message;
    } finally {
      result.status = transactionStatus;

      await this.transactionsRepo.update(
        {
          id: transaction.id,
        },
        {
          status: transactionStatus,
          executedAt,
          statusCode: transactionStatusCode,
        },
      );

      client.close();

      notifySyncIndicators(this.notificationsService, transaction.id, transaction.status);
      notifyTransactionAction(this.notificationsService);

      this.sideEffect(sdkTransaction, transaction.mirrorNetwork);
    }
    return result;
  }

  private async getValidatedSDKTransaction(
    transaction: ExecuteTransactionDto,
  ): Promise<SDKTransaction> {
    /* Throws an error if the transaction is not found or in incorrect state */
    if (!transaction) throw new Error('Transaction not found');

    await this.validateTransactionStatus(transaction);

    /* Gets the SDK transaction from the transaction body */
    const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

    /* Gets the signature key */
    const signatureKey = await computeSignatureKey(
      sdkTransaction,
      this.mirrorNodeService,
      transaction.mirrorNetwork,
    );

    /* Checks if the transaction has valid signatureKey */
    if (!hasValidSignatureKey([...sdkTransaction._signerPublicKeys], signatureKey))
      throw new Error('Transaction has invalid signature.');

    return sdkTransaction;
  }

  /* Throws if the transaction is not in a valid state */
  private async validateTransactionStatus(transaction: ExecuteTransactionDto) {
    const { status } = await this.transactionsRepo.findOne({
      where: { id: transaction.id },
      select: ['status'],
    });

    switch (status) {
      case TransactionStatus.NEW:
        throw new Error('Transaction is new and has not been signed yet.');
      case TransactionStatus.FAILED:
        throw new Error('Transaction has already been executed, but failed.');
      case TransactionStatus.EXECUTED:
        throw new Error('Transaction has already been executed.');
      case TransactionStatus.REJECTED:
        throw new Error('Transaction has already been rejected.');
      case TransactionStatus.EXPIRED:
        throw new Error('Transaction has been expired.');
      case TransactionStatus.CANCELED:
        throw new Error('Transaction has been canceled.');
      case TransactionStatus.ARCHIVED:
        throw new Error('Transaction is archived.');
    }
  }

  private sideEffect(sdkTransaction: SDKTransaction, mirrorNetwork: string) {
    if (transactionIs(AccountUpdateTransaction, sdkTransaction)) {
      setTimeout(async () => {
        try {
          await this.mirrorNodeService.updateAccountInfo(
            sdkTransaction.accountId.toString(),
            mirrorNetwork,
          );
        } catch (error) {
          console.log('Error updating account info', error);
        }
      }, 5 * 1_000);
    } else if (transactionIs(NodeUpdateTransaction, sdkTransaction)) {
      setTimeout(async () => {
        try {
          await this.mirrorNodeService.updateNodeInfo(
            sdkTransaction.nodeId?.toNumber(),
            mirrorNetwork,
          );
        } catch (error) {
          console.log('Error updating node info', error);
        }
      }, 5 * 1_000);
    }
  }
}
