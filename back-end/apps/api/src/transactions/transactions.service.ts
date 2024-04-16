import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import { PublicKey, Transaction as SDKTransaction } from '@hashgraph/sdk';

import { Like, Repository, FindOptionsWhere } from 'typeorm';

import { Transaction, TransactionStatus, User } from '@entities';

import {
  NOTIFICATIONS_SERVICE,
  encodeUint8Array,
  getClientFromConfig,
  getTransactionTypeEnumValue,
  isExpired,
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
    private readonly httpService: HttpService,
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

  // Get all transactions that need to be signed by the user.
  // Include the creator key in the response.
  // This process will require pulling the current account info
  // for each account that each user key for this user.
  async getTransactionsToSign(user: User, take: number, skip: number): Promise<Transaction[]> {
    // There must be a better way to do this, but for now...
    // All lookup requests will return a promise, put them all into
    // one array to be processed at the end.
    const accountRequests: Promise<any>[] = [];
    // Sets for:
    // the accounts for all the keys,
    // receiver accounts that require a signature on transfers,
    // and for each key of the user
    const accounts = new Set<string>();
    const receiverAccounts = new Set<string>();
    const keys = new Set<string>();
    // For each key, get all associated accounts, adding to the set
    for (const userKey of user.keys) {
      const key = userKey.publicKey;
      // add the user key to the set of keys
      keys.add(key);
      // request the accounts associated with this public key
      const promise = this.httpService.axiosRef.get(
        `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts?account.publickey=${key}`,
      );
      // when a response is received, add each account to the accounts set
      // then, if the account requires a signature for receiving tokens, add it to the receiver set
      promise.then(response => {
        const accountsForKey = response.data['accounts'];
        if (accountsForKey) {
          for (const account of accountsForKey) {
            const accountId = account.account;
            accounts.add(accountId);
            if (account['receiver_sig_required']) {
              receiverAccounts.add(accountId);
            }
          }
        }
      });

      // push the promise into the requests array
      accountRequests.push(promise);
    }
    // await for all requests to finish
    await Promise.all(accountRequests);

    // build the where options for the query, each item in each set will need one.
    const whereOptions = [];
    this.buildWhereOptions('accounts', accounts, whereOptions);
    this.buildWhereOptions('accounts', receiverAccounts, whereOptions);
    this.buildWhereOptions('newKeys', keys, whereOptions);

    // return the transactions found along with the creator info
    return this.repo.find({
      relations: ['creatorKey'],
      where: whereOptions,
      take: take,
      skip: skip,
    });
  }

  private buildWhereOptions(
    fieldName: string,
    values: Set<string>,
    whereOptions: FindOptionsWhere<any>[],
  ) {
    for (const value of values) {
      whereOptions.push({ [fieldName]: Like('%' + value + '%') });
    }
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

  // Create a transaction for the provided information
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
      status: TransactionStatus.WAITING_FOR_EXECUTION,
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

  // For the given transaction, the three searchable fields will need to be set.
  // The transaction will need to be parsed from the transaction body, then the
  // accounts and keys to be added to the search fields need to be determined.
  private setSearchableFields(transaction: Transaction): void {
    // Get the list of accounts or keys required to sign the transaction
    // Join the list and return
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
