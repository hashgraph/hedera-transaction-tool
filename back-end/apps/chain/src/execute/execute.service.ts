import { ClientProxy } from '@nestjs/microservices';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { MurLock } from 'murlock';
import {
  AccountUpdateTransaction,
  FileAppendTransaction,
  FileUpdateTransaction,
  Transaction as SDKTransaction,
  Status,
} from '@hashgraph/sdk';

import { Transaction, TransactionStatus, Network } from '@entities';

import {
  MirrorNodeService,
  NOTIFICATIONS_SERVICE,
  NOTIFY_CLIENT,
  NotifyClientDto,
  TRANSACTION_ACTION,
  TransactionExecutedDto,
  ableToSign,
  computeSignatureKey,
  getClientFromName,
  getStatusCodeFromMessage,
} from '@app/common';

@Injectable()
export class ExecuteService {
  constructor(
    @InjectRepository(Transaction) private transactionsRepo: Repository<Transaction>,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
    private readonly mirrorNodeService: MirrorNodeService,
  ) {}

  /* Tries to execute a transaction */
  @MurLock(5000, 'transactionId')
  async executeTransaction(transactionId: number) {
    /* Gets the transaction from the database */
    const transaction = await this.transactionsRepo.findOne({
      where: {
        id: transactionId,
      },
      relations: {
        signers: true,
        approvers: true,
        observers: true,
        creatorKey: true,
      },
    });

    /* Throws an error if the transaction is not found or in incorrect state */
    if (!transaction) throw new Error('Transaction not found');
    this.validateTransactionStatus(transaction);

    /* Gets the SDK transaction from the transaction body */
    const sdkTransaction = SDKTransaction.fromBytes(transaction.body);

    /* Throws an error if the transaction is a file update/append transaction */
    if (
      sdkTransaction instanceof FileUpdateTransaction ||
      sdkTransaction instanceof FileAppendTransaction
    )
      throw new Error('File transactions are not currently supported for execution.');

    /* Gets the signature key */
    const sigantureKey = await computeSignatureKey(
      sdkTransaction,
      this.mirrorNodeService,
      transaction.network,
    );

    /* Checks if the transaction has valid siganture */
    if (!ableToSign([...sdkTransaction._signerPublicKeys], sigantureKey))
      throw new Error('Transaction has invalid signature.');

    /* Execute the transaction */
    const client = getClientFromName(transaction.network);

    let statusCode = 21;

    transaction.executedAt = new Date();
    transaction.status = TransactionStatus.EXECUTED;

    const result: TransactionExecutedDto = {
      status: transaction.status,
    };

    try {
      const response = await sdkTransaction.execute(client);
      const receipt = await response.getReceipt(client);

      result.response = JSON.stringify(response.toJSON());
      result.receipt = JSON.stringify(receipt.toJSON());
      result.receiptBytes = Buffer.from(receipt.toBytes());
      transaction.statusCode = receipt.status._code || Status.Ok._code;
    } catch (error) {
      statusCode = error.status?._code || 21;
      if (!error.status) statusCode = getStatusCodeFromMessage(error.message);
      transaction.status = TransactionStatus.FAILED;
      transaction.statusCode = statusCode;
      result.error = error.message;
    } finally {
      result.status = transaction.status;

      await this.transactionsRepo.update(
        {
          id: transaction.id,
        },
        {
          status: transaction.status,
          executedAt: transaction.executedAt,
          statusCode: transaction.statusCode,
        },
      );

      client.close();

      this.notificationsService.emit<undefined, NotifyClientDto>(NOTIFY_CLIENT, {
        message: TRANSACTION_ACTION,
        content: '',
      });

      this.sideEffect(sdkTransaction, transaction.network);
    }
    return result;
  }

  /* Throws if the transaction is not in a valid state */
  private validateTransactionStatus(transaction: Transaction) {
    switch (transaction.status) {
      case TransactionStatus.NEW:
        throw new Error('Transaction is new and has not been signed yet.');
      case TransactionStatus.FAILED:
        throw new Error('Transaction has already been executed, but failed.');
      case TransactionStatus.EXECUTED:
        throw new Error('Transaction has already been executed.');
      case TransactionStatus.REJECTED:
        throw new Error('Transaction has already been rejected.');
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
