import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import {
  FileAppendTransaction,
  FileUpdateTransaction,
  Transaction as SDKTransaction,
} from '@hashgraph/sdk';

import { Transaction, TransactionStatus } from '@entities';

import { UpdateTransactionStatusDto } from './dto';
import { MirrorNodeService, ableToSign, computeSignatureKey } from '@app/common';

@Injectable()
export class TransactionStatusService {
  constructor(
    @InjectRepository(Transaction) private transactionRepo: Repository<Transaction>,
    private readonly mirrorNodeService: MirrorNodeService,
  ) {}

  /* Checks if the signers are enough to sign the transaction */
  async updateTransactionStatus({ id }: UpdateTransactionStatusDto) {
    const transaction = await this.transactionRepo.findOne({ where: { id } });

    /* Returns if the transaction is not found */
    if (!transaction) return;

    /* Gets the SDK transaction from the transaction body */
    const sdkTransaction = SDKTransaction.fromBytes(transaction.body);

    /* Throws an error if the transaction is a file update/append transaction */
    if (
      sdkTransaction instanceof FileUpdateTransaction ||
      sdkTransaction instanceof FileAppendTransaction
    )
      return;

    /* Gets the signature key */
    const sigantureKey = await computeSignatureKey(sdkTransaction, this.mirrorNodeService);

    /* Checks if the transaction has valid siganture */
    if (!ableToSign([...sdkTransaction._signerPublicKeys], sigantureKey)) return;

    transaction.status = TransactionStatus.WAITING_FOR_EXECUTION;
    await this.transactionRepo.save(transaction);
  }
}
