import { ClientProxy } from '@nestjs/microservices';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { MurLock } from 'murlock';
import { AccountUpdateTransaction, Transaction as SDKTransaction, Status } from '@hashgraph/sdk';

import { Transaction, TransactionStatus, Network } from '@entities';

import {
  MirrorNodeService,
  NOTIFICATIONS_SERVICE,
  TransactionExecutedDto,
  hasValidSignatureKey,
  computeSignatureKey,
  getClientFromName,
  getStatusCodeFromMessage,
  notifyTransactionAction,
  notifySyncIndicators,
} from '@app/common';
import { ExecuteTransactionDto } from '@app/common/dtos/execute-transaction.dto';

@Injectable()
export class ExecuteService {
  constructor(
    @InjectRepository(Transaction) private transactionsRepo: Repository<Transaction>,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
    private readonly mirrorNodeService: MirrorNodeService,
  ) {}

  /* Tries to execute a transaction */
  @MurLock(5000, 'transaction.id')
  async executeTransaction(transaction: ExecuteTransactionDto) {
    /* Throws an error if the transaction is not found or in incorrect state */
    if (!transaction) throw new Error('Transaction not found');
    this.validateTransactionStatus(transaction);

    /* Gets the SDK transaction from the transaction body */
    const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

    /* Gets the signature key */
    const signatureKey = await computeSignatureKey(
      sdkTransaction,
      this.mirrorNodeService,
      transaction.network,
    );

    /* Checks if the transaction has valid signatureKey */
    if (!hasValidSignatureKey([...sdkTransaction._signerPublicKeys], signatureKey))
      throw new Error('Transaction has invalid signature.');

    /* Execute the transaction */
    const client = getClientFromName(transaction.network);

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

      this.sideEffect(sdkTransaction, transaction.network);
    }
    return result;
  }

  /* Throws if the transaction is not in a valid state */
  private validateTransactionStatus(transaction: { status: TransactionStatus }) {
    switch (transaction.status) {
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
    }
  }

  private sideEffect(sdkTransaction: SDKTransaction, network: Network) {
    if (sdkTransaction instanceof AccountUpdateTransaction) {
      setTimeout(async () => {
        await this.mirrorNodeService.updateAccountInfo(
          sdkTransaction.accountId.toString(),
          network,
        );
      }, 5 * 1_000);
    }
  }
}
