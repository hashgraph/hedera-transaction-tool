import { ConfigService } from '@nestjs/config';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import {
  FileAppendTransaction,
  FileUpdateTransaction,
  KeyList,
  Transaction as SDKTransaction,
} from '@hashgraph/sdk';

import { Transaction, TransactionStatus } from '@entities';

import {
  MirrorNodeService,
  ableToSign,
  getClientFromConfig,
  getSignatureEntities,
  getStatusCodeFromMessage,
  parseAccountProperty,
} from '@app/common';

import { TranasctionExecutedDto } from './dtos';

@Injectable()
export class ExecuteService {
  constructor(
    @InjectRepository(Transaction) private transactionsRepo: Repository<Transaction>,
    private readonly configService: ConfigService,
    private readonly mirrorNodeService: MirrorNodeService,
  ) {}

  /* Tries to execute a transaction */
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
    if (!transaction) throw new BadRequestException('Transaction not found');
    this.validateTransactionStatus(transaction);

    /* Gets the SDK transaction from the transaction body */
    const sdkTransaction = SDKTransaction.fromBytes(transaction.body);

    /* Throws an error if the transaction is a file update/append transaction */
    if (
      sdkTransaction instanceof FileUpdateTransaction ||
      sdkTransaction instanceof FileAppendTransaction
    )
      throw new BadRequestException('File transactions are not currently supported for execution.');

    /* Gets the signature key */
    const sigantureKey = await this.computeSignatureKey(sdkTransaction);

    /* Checks if the transaction has valid siganture */
    if (!ableToSign([...sdkTransaction._signerPublicKeys], sigantureKey))
      throw new BadRequestException('Transaction has invalid signature.');

    /* Execute the transaction */
    const client = getClientFromConfig(this.configService);

    let statusCode = 21;

    transaction.executedAt = new Date();
    transaction.status = TransactionStatus.EXECUTED;

    const result: TranasctionExecutedDto = { transaction };

    try {
      const response = await sdkTransaction.execute(client);
      const receipt = await response.getReceipt(client);

      result.response = JSON.stringify(response.toJSON());
      result.receiptBytes = Buffer.from(receipt.toBytes());
    } catch (error) {
      statusCode = error.status?._code || 21;
      if (!error.status) statusCode = getStatusCodeFromMessage(error.message);
      transaction.status = TransactionStatus.FAILED;
      transaction.statusCode = statusCode;
      result.error = error.message;
      result.transaction = transaction;
    } finally {
      await this.transactionsRepo.save(transaction);
    }
  }

  /* Throws if the transaction is not in a valid state */
  private validateTransactionStatus(transaction: Transaction) {
    switch (transaction.status) {
      case TransactionStatus.NEW:
        throw new BadRequestException('Transaction is new and has not been signed yet.');
      case TransactionStatus.FAILED:
        throw new BadRequestException('Transaction has already been executed, but failed.');
      case TransactionStatus.EXECUTED:
        throw new BadRequestException('Transaction has already been executed.');
      case TransactionStatus.REJECTED:
        throw new BadRequestException('Transaction has already been rejected.');
    }
  }

  /* Computes the signature key for the transaction */
  private async computeSignatureKey(transaction: SDKTransaction) {
    /* Get the accounts, receiver accounts and new keys from the transaction */
    const { accounts, receiverAccounts, newKeys } = getSignatureEntities(transaction);

    /* Create a new key list */
    const sigantureKey = new KeyList();

    /* Add keys to the signature key list */
    newKeys.forEach(key => sigantureKey.push(key));

    /* Add the keys of the account ids to the signature key list */
    for (const accountId of accounts) {
      const accountInfo = await this.mirrorNodeService.getAccountInfo(accountId);
      const key = parseAccountProperty(accountInfo, 'key');
      if (!key) continue;

      sigantureKey.push(key);
    }

    /* Check if there is a receiver account that required signature, if so add it to the key list */
    for (const accountId of receiverAccounts) {
      const accountInfo = await this.mirrorNodeService.getAccountInfo(accountId);
      const receiverSigRequired = parseAccountProperty(accountInfo, 'receiver_sig_required');
      if (!receiverSigRequired) continue;

      const key = parseAccountProperty(accountInfo, 'key');
      if (!key) continue;

      sigantureKey.push(key);
    }

    return sigantureKey;
  }
}
