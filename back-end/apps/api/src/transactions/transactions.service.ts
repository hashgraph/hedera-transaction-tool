import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import { Key, KeyList, PublicKey, Transaction as SDKTransaction } from '@hashgraph/sdk';

import { Repository } from 'typeorm';

import { Transaction, TransactionStatus, User } from '@entities';

import {
  NOTIFICATIONS_SERVICE,
  MirrorNodeService,
  encodeUint8Array,
  getClientFromConfig,
  getTransactionTypeEnumValue,
  isExpired,
  isPublicKeyInKeyList,
  parseAccountProperty,
} from '@app/common';
import TransactionFactory from '@app/common/models/transaction-factory';

import { UserDto } from '../users/dtos';
import { CreateTransactionDto } from './dto/create-transaction.dto';

import { UserKeysService } from '../user-keys/user-keys.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private repo: Repository<Transaction>,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
    private readonly configService: ConfigService,
    private readonly userKeysService: UserKeysService,
    private readonly mirrorNodeService: MirrorNodeService,
  ) {}

  // Get the transaction for the provided transaction id.
  // Include the creator key information in the response.
  getTransactionById(id: number): Promise<Transaction> {
    if (!id) {
      return null;
    }
    return this.repo
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.creatorKey', 'creatorKey')
      .where('transaction.id = :id', { id })
      .getOne();
  }

  // Get the transactions created by the user.
  // Include the creator key in the response
  async getTransactions(user: User): Promise<Transaction[]> {
    return this.repo
      .createQueryBuilder('transaction') // Find Transactions
      .leftJoinAndSelect('transaction.creatorKey', 'creatorKey') // where the creator key
      .where('creatorKey.userId = :userId', { userId: user.id }) // has a userId = user.id
      .getMany();
  }

  async getTransactionsToSign(user: User, take: number, skip: number): Promise<Transaction[]> {
    const userKeys = await this.userKeysService.getUserKeys(user.id);

    const result: Transaction[] = [];

    const transactions = await this.repo.find({
      where: { status: TransactionStatus.WAITING_FOR_SIGNATURES },
    });

    for (const transaction of transactions) {
      const sdkTransaction = SDKTransaction.fromBytes(transaction.body);

      /* Ignore if expired */
      /* if (isExpired(sdkTransaction)) continue; */

      /* Get signature entities */
      const { newKeys, accounts, receiverAccounts } = this.getSignatureEntities(sdkTransaction);

      /* Check if the user has a key that is required to sign */
      const userKeysIncludedInTransaction = userKeys.filter(userKey =>
        newKeys.includes(userKey.publicKey),
      );
      if (userKeysIncludedInTransaction.length > 0) {
        result.push(transaction);
        continue;
      }

      const someUserKeyInOrIsKey = (key: Key) =>
        (key instanceof PublicKey &&
          userKeys.some(userKey => userKey.publicKey === key.toStringRaw())) ||
        (key instanceof KeyList &&
          userKeys.some(userKey => isPublicKeyInKeyList(userKey.publicKey, key)));

      /* Check if a key of the user is inside the key of some account required to sign */
      let added = false;
      for (const accountId of accounts) {
        const accountInfo = await this.mirrorNodeService.getAccountInfo(accountId);
        const key = parseAccountProperty(accountInfo, 'key');
        if (!key) continue;

        if (someUserKeyInOrIsKey(key)) {
          result.push(transaction);
          added = true;
          break;
        }
      }
      if (added) continue;

      /* Check if user has a key included in a receiver account that required signature */
      for (const accountId of receiverAccounts) {
        const accountInfo = await this.mirrorNodeService.getAccountInfo(accountId);
        const receiverSigRequired = parseAccountProperty(accountInfo, 'receiver_sig_required');
        if (!receiverSigRequired) continue;

        const key = parseAccountProperty(accountInfo, 'key');
        if (!key) continue;

        if (someUserKeyInOrIsKey(key)) {
          result.push(transaction);
          added = true;
          break;
        }
      }
    }
    return result;
  }

  // Get all transactions that need to be approved by the user.
  // Include the creator key in the response.
  //TODO with postgres, there should be a cleaner way to do this
  getTransactionsToApprove(user: User, take: number, skip: number): Promise<Transaction[]> {
    const userKeys = user.keys.map(userKey => userKey.id).join(',');
    return this.repo.query(
      `with recursive approverList as ` +
        `(select * from transaction_approver where "userKeyId" in (${userKeys}) ` +
        `union all ` +
        `select approver.* from transaction_approver as approver ` +
        `join approverList on approverList."listId" = approver.id) ` +
        `select distinct t.*, userKey.* from "transaction" as t ` +
        `join user_key as userKey on t."creatorKeyId" = userKey.id ` +
        `join approverList on t.id = "transactionId" LIMIT ${take} OFFSET ${skip}`,
    );
  }

  // Get all transactions that can be observed by the user.
  // Include the creator key in the response
  //TODO the role of the user as on observer needs to limit the response
  getTransactionsToObserve(user: User, take: number, skip: number): Promise<Transaction[]> {
    return this.repo
      .createQueryBuilder('transaction') // Find Transactions (and necessary parts)
      .leftJoinAndSelect('transaction.creatorKey', 'creatorKey')
      .leftJoin('transaction.observers', 'observer') // where the list of observer's
      .where('observer.userId = :userId', { userId: user.id }) // has a userId = user.id
      .take(take)
      .skip(skip)
      .getMany();
  }

  /* Create a new transaction with the provided information */
  async createTransaction(dto: CreateTransactionDto, user: UserDto): Promise<Transaction> {
    const userKeys = await this.userKeysService.getUserKeys(user.id);
    const creatorKey = userKeys.find(key => key.id === dto.creatorKeyId);

    if (!userKeys.some(key => key.id === dto.creatorKeyId))
      throw new BadRequestException("Creator key doesn't belong to the user");
    const publicKey = PublicKey.fromString(creatorKey.publicKey);

    const validSignature = publicKey.verify(dto.body, dto.signature);
    if (!validSignature)
      throw new BadRequestException('The signature does not match the public key');

    const sdkTransaction = SDKTransaction.fromBytes(dto.body);
    if (isExpired(sdkTransaction)) throw new BadRequestException('Transaction is expired');

    const countExisting = await this.repo.count({
      where: [{ transactionId: sdkTransaction.transactionId.toString() }, { body: dto.body }],
    });
    if (countExisting > 0) throw new BadRequestException('Transaction already exists');

    const client = getClientFromConfig(this.configService);
    sdkTransaction.freezeWith(client);

    const transaction = this.repo.create({
      name: dto.name,
      type: getTransactionTypeEnumValue(sdkTransaction),
      description: dto.description,
      transactionId: sdkTransaction.transactionId.toString(),
      transactionHash: encodeUint8Array(await sdkTransaction.getTransactionHash()),
      body: sdkTransaction.toBytes(),
      status: TransactionStatus.WAITING_FOR_SIGNATURES,
      creatorKey,
      signature: dto.signature,
      validStart: sdkTransaction.transactionId.validStart.toDate(),
      cutoffAt: dto.cutoffAt,
    });
    client.close();

    this.setSearchableFields(transaction);

    try {
      await this.repo.save(transaction);
    } catch (error) {
      throw new BadRequestException('Failed to save transaction');
    }

    this.notificationsService.emit('notify_transaction_members', transaction);

    return transaction;
  }

  // Update the transaction for the given transaction id with the provided information.
  async updateTransaction(id: number, attrs: Partial<Transaction>): Promise<Transaction> {
    const transaction = await this.getTransactionById(id);

    if (!transaction) {
      throw new Error('transaction not found');
    }

    Object.assign(transaction, attrs);
    return transaction;
  }

  // Remove the transaction for the given transaction id.
  async removeTransaction(id: number): Promise<Transaction> {
    const transaction = await this.getTransactionById(id);

    if (!transaction) {
      throw new Error('transaction not found');
    }

    return this.repo.remove(transaction);
  }

  /* Gets the keys and potential accounts that are required to sign the transaction */
  private getSignatureEntities(transaction: SDKTransaction) {
    try {
      const transactionModel = TransactionFactory.fromTransaction(transaction);

      const result = {
        accounts: [...transactionModel.getSigningAccounts()],
        receiverAccounts: [...transactionModel.getReceiverAccounts()],
        newKeys: [...transactionModel.getNewKeys()],
      };

      /* To get keys for files */

      return result;
    } catch (err) {
      console.log(err);
      return {
        accounts: [],
        receiverAccounts: [],
        newKeys: [],
      };
    }
  }

  private setSearchableFields(transaction: Transaction): void {
    try {
      const transactionModel = TransactionFactory.fromBytes(transaction.body);

      transaction.accounts = [...transactionModel.getSigningAccounts()];
      transaction.receiverAccounts = [...transactionModel.getReceiverAccounts()];
      transaction.newKeys = [...transactionModel.getNewKeys()];
    } catch (err) {
      //TODO handle this error
      transaction.accounts = [];
      transaction.receiverAccounts = [];
      transaction.newKeys = [];
    }
  }
}
