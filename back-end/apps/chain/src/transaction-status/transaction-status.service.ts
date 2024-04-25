import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import {
  FileAppendTransaction,
  FileUpdateTransaction,
  KeyList,
  Transaction as SDKTransaction,
} from '@hashgraph/sdk';

import { Transaction, TransactionStatus } from '@entities';

import { UpdateTransactionStatusDto } from './dto';
import {
  MirrorNodeService,
  ableToSign,
  getSignatureEntities,
  parseAccountProperty,
} from '@app/common';

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
    const sigantureKey = await this.computeSignatureKey(sdkTransaction);

    /* Checks if the transaction has valid siganture */
    if (!ableToSign([...sdkTransaction._signerPublicKeys], sigantureKey)) return;

    transaction.status = TransactionStatus.WAITING_FOR_EXECUTION;
    await this.transactionRepo.save(transaction);
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
