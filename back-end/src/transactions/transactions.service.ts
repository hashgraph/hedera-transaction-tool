import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { Repository } from 'typeorm';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { User } from '../entities/user.entity';
import TransactionFactory from '../models/transaction-factory';
import { UserKeysService } from '../user-keys/user-keys.service';
import { HttpService } from '@nestjs/axios';
import { AccountInfo } from '@hashgraph/sdk';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private repo: Repository<Transaction>,
    private userKeysService: UserKeysService,
    private readonly httpService: HttpService,
  ) {}

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

  //TODO Notion page says to combine these, but not sure if that is better. It would also require the client to
  // separate them into the different types (creator,signer,approver,observer).

  // Get the transactions created by the user
  async getTransactions(user: User): Promise<Transaction[]> {
    return this.repo
      .createQueryBuilder('transaction') // Find Transactions
      .leftJoinAndSelect('transaction.creatorKey', 'creatorKey') // where the creator key
      .where('creatorKey.userId = :userId', { userId: user.id }) // has a userId = user.id
      .getMany();
  }

  async getTransactionsToSign(user: User): Promise<Transaction[]> {
    // Get all keys for this user
    const userKeys = await this.userKeysService.getKeysById(user.id);
    // Add all the keys to the set
    const accountsOrKeys = new Set<string>(userKeys.map((userKey) => userKey.publicKey));
    // For each key, get all associated accounts, adding to the set
    for (const userKey of userKeys) {
      // set.addAll(sdk.getAccountsByKey(userKey));
      // https://mainnet-public.mirrornode.hedera.com/api/v1/accounts?account.publickey=userKey.publicKey
      const accountInfo: AccountInfo[] = await this.httpService.axiosRef.get(`https://mainnet-public.mirrornode.hedera.com/api/v1/accounts?account.publickey=${userKey.publicKey}`);
      const accountIds = new Set<string>();
      const receiverAccountIds = new Set<string>();
      accountInfo.forEach((info) => {
        accountIds.add(info.accountId.toString());
        if (info.isReceiverSignatureRequired) {
          receiverAccountIds.add("R:".concat(info.accountId.toString()));
        }
      });
    }
    // Use the set of accounts or keys to search to database for transactions.
    const things = this.repo
      .createQueryBuilder('transactions')
      .leftJoinAndSelect('transaction.createKey', 'creatorKey')
      .where('accountsOrKeys LIKE %:accountsOrKeys%', { accountsOrKeys })
      .getMany();
    // If the transaction has a receiver account that does NOT require signature, remove those from the list
    //TODO but what if I instead had a second column for receiver accountId(s - can be plural) and then
    //when pulling accounts by publicKey, determine if those accounts should be in the receiver list AND the
    //other list
    return things;
  }

  getTransactionsToApprove(user: User): Promise<Transaction[]> {
    return this.repo
      .createQueryBuilder('transaction') // Find Transactions (and necessary parts)
      .leftJoinAndSelect('transaction.creatorKey', 'creatorKey')
      .leftJoin('transaction.approvers', 'approver') // where the list of approver's
      .leftJoin('approver.userKey', 'userKey') // has a userKey
      .where('userKey.userId = :userId', { userId: user.id }) // where the userId = user.id
      .getMany();
  }

  getTransactionsToObserve(user: User) {
    return this.repo
      .createQueryBuilder('transaction') // Find Transactions (and necessary parts)
      .leftJoinAndSelect('transaction.creatorKey', 'creatorKey')
      .leftJoin('transaction.observers', 'observer') // where the list of observer's
      .where('observer.userId = :userId', { userId: user.id }) // has a userId = user.id
      .getMany();
  }

  createTransaction(dto: CreateTransactionDto): Promise<Transaction> {
    const transaction = this.repo.create(dto);
    transaction['creatorKey' as any] = dto.creatorKeyId;
    transaction.accountsOrKeys = this.buildAccountOrKeyList(transaction);
    return this.repo.save(transaction);
  }

  async updateTransaction(
    id: number,
    attrs: Partial<Transaction>,
  ): Promise<Transaction> {
    const transaction = await this.getTransactionById(id);

    if (!transaction) {
      throw new Error('transaction not found');
    }

    Object.assign(transaction, attrs);
    return transaction;
  }

  async removeTransaction(id: number): Promise<Transaction> {
    const transaction = await this.getTransactionById(id);

    if (!transaction) {
      throw new Error('transaction not found');
    }

    return this.repo.softRemove(transaction);
  }

  private buildAccountOrKeyList(transaction: Transaction) {
    // Get the list of accounts or keys required to sign the transaction
    // Join the list and return
    const transactionModel = TransactionFactory.fromBytes(transaction.body);
    const accounts = transactionModel.getSigningAccountsOrKeys();
    return [...accounts].join(',');
  }
}
