import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import {
  FileAppendTransaction,
  FileUpdateTransaction,
  Key,
  KeyList,
  PublicKey,
  Transaction as SDKTransaction,
} from '@hashgraph/sdk';

import { DeepPartial, Repository, MoreThan } from 'typeorm';

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
  getSignatureEntities,
} from '@app/common';

import { UserDto } from '../users/dtos';
import { CreateTransactionDto } from './dto/create-transaction.dto';

import { UserKeysService } from '../user-keys/user-keys.service';
import { SignersService } from './signers/signers.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private repo: Repository<Transaction>,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
    private readonly configService: ConfigService,
    private readonly userKeysService: UserKeysService,
    private readonly signersService: SignersService,
    private readonly mirrorNodeService: MirrorNodeService,
  ) {}

  /* Get the transaction for the provided id in the DATABASE */
  async getTransactionById(id: number): Promise<Transaction> {
    if (!id) return null;

    const transaction = await this.repo.findOne({
      where: { id },
      relations: [
        'creatorKey',
        'creatorKey.user',
        'approvers',
        'observers',
        'comments',
        'signers',
        'signers.userKey',
      ],
    });

    if (!transaction) return null;

    transaction.signers = await this.signersService.getSignaturesByTransactionId(
      transaction.id,
      true,
    );

    return transaction;
  }

  /* Get the transaction for the provided transaction id OF THE TRANSACTION */
  async getTransactionId(id: string): Promise<Transaction> {
    if (!id) return null;

    const transaction = await this.repo.findOne({
      where: { transactionId: id },
      relations: ['creatorKey', 'approvers', 'observers', 'comments', 'signers', 'signers.userKey'],
    });

    transaction.signers = await this.signersService.getSignaturesByTransactionId(
      transaction.id,
      true,
    );

    return transaction;
  }

  /* Get the transactions created by the user */
  async getTransactions(user: User, take: number = 10, skip: number = 0): Promise<Transaction[]> {
    return this.repo.find({
      where: {
        creatorKey: {
          user: {
            id: user.id,
          },
        },
      },
      relations: {
        creatorKey: true,
      },
      skip,
      take,
    });
  }

  /* Get the transactions that a user needs to sign */
  async getTransactionsToSign(
    user: User,
    take: number,
    skip: number,
  ): Promise<
    {
      transaction: Transaction;
      keysToSign: number[];
    }[]
  > {
    const result: {
      transaction: Transaction;
      keysToSign: number[];
    }[] = [];

    /* Ensures the user keys are passed */
    if (user.keys.length === 0) {
      user.keys = await this.userKeysService.getUserKeys(user.id);
      if (user.keys.length === 0) return [];
    }

    const transactions = await this.repo.find({
      where: {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        validStart: MoreThan(new Date(new Date().getTime() + 180 * 1_000)),
      },
    });

    for (const transaction of transactions) {
      /* Stop if necessary number of transactions are found */
      if (result.length === take + skip) break;

      /* Check if the user should sign the transaction */
      const keysToSign = await this.userKeysRequiredToSign(transaction, user);

      if (keysToSign.length > 0) result.push({ transaction, keysToSign });
    }
    return result.slice(skip, take + skip);
  }

  /* Get the count of transactions that a user needs to sign */
  async getTransactionsToSignCount(user: User): Promise<number> {
    let count = 0;

    /* Ensures the user keys are passed */
    if (user.keys.length === 0) {
      user.keys = await this.userKeysService.getUserKeys(user.id);
      if (user.keys.length === 0) return count;
    }

    const transactions = await this.repo.find({
      where: {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        validStart: MoreThan(new Date(new Date().getTime() + 180 * 1_000)),
      },
    });

    for (const transaction of transactions) {
      /* Check if the user should sign the transaction */
      const keysToSign = await this.userKeysRequiredToSign(transaction, user);

      if (keysToSign.length > 0) count++;
    }

    return count;
  }

  /* Returns wheter a user should sign the transaction */
  async userKeysRequiredToSign(transaction: Transaction, user: User): Promise<number[]> {
    const userKeyIdsRequired: Set<number> = new Set<number>();

    if (!transaction || transaction.status != TransactionStatus.WAITING_FOR_SIGNATURES) {
      return [];
    }

    /* Ensures the user keys are passed */
    if (user.keys.length === 0) {
      user.keys = await this.userKeysService.getUserKeys(user.id);
      if (user.keys.length === 0) return [];
    }

    /* Gets the user signatures for this transaction */
    const signatures = await this.signersService.getSignatureByTransactionIdAndUserId(
      transaction.id,
      user.id,
    );

    /* Deserialize the transaction */
    const sdkTransaction = SDKTransaction.fromBytes(transaction.body);

    /* Ignore if expired */
    if (isExpired(sdkTransaction)) return [];

    /* Get signature entities */
    const { newKeys, accounts, receiverAccounts } = getSignatureEntities(sdkTransaction);

    /* Check if the user has a key that is required to sign */
    const userKeysIncludedInTransaction = user.keys.filter(
      userKey =>
        newKeys.some(key =>
          isPublicKeyInKeyList(
            userKey.publicKey,
            key instanceof KeyList ? key : new KeyList([key]),
          ),
        ) && !signatures.some(s => s.userKeyId === userKey.id),
    );
    userKeysIncludedInTransaction.forEach(userKey => userKeyIdsRequired.add(userKey.id));

    const userKeyInKeyOrIsKey = (key: Key) =>
      (key instanceof PublicKey &&
        user.keys.filter(
          userKey =>
            userKey.publicKey === key.toStringRaw() &&
            !signatures.some(s => s.userKeyId === userKey.id),
        )) ||
      (key instanceof KeyList &&
        user.keys.filter(
          userKey =>
            isPublicKeyInKeyList(userKey.publicKey, key) &&
            !signatures.some(s => s.userKeyId === userKey.id),
        ));

    /* Check if a key of the user is inside the key of some account required to sign */
    for (const accountId of accounts) {
      const accountInfo = await this.mirrorNodeService.getAccountInfo(accountId);
      const key = parseAccountProperty(accountInfo, 'key');
      if (!key) continue;

      userKeyInKeyOrIsKey(key).forEach(userKey => userKeyIdsRequired.add(userKey.id));
    }

    /* Check if user has a key included in a receiver account that required signature */
    for (const accountId of receiverAccounts) {
      const accountInfo = await this.mirrorNodeService.getAccountInfo(accountId);
      const receiverSigRequired = parseAccountProperty(accountInfo, 'receiver_sig_required');
      if (!receiverSigRequired) continue;

      const key = parseAccountProperty(accountInfo, 'key');
      if (!key) continue;

      userKeyInKeyOrIsKey(key).forEach(userKey => userKeyIdsRequired.add(userKey.id));
    }

    return [...userKeyIdsRequired];
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

    /* Check if the key belongs to the user */
    if (!userKeys.some(key => key.id === dto.creatorKeyId))
      throw new BadRequestException("Creator key doesn't belong to the user");
    const publicKey = PublicKey.fromString(creatorKey.publicKey);

    /* Verify the signature matches the transaction */
    const validSignature = publicKey.verify(dto.body, dto.signature);
    if (!validSignature)
      throw new BadRequestException('The signature does not match the public key');

    /* Check if the transaction is expired */
    const sdkTransaction = SDKTransaction.fromBytes(dto.body);
    if (
      sdkTransaction instanceof FileUpdateTransaction ||
      sdkTransaction instanceof FileAppendTransaction
    )
      throw new BadRequestException('File Update/Append transactions are not currently supported');
    if (isExpired(sdkTransaction)) throw new BadRequestException('Transaction is expired');

    /* Check if the transaction already exists */
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

    try {
      await this.repo.save(transaction);
    } catch (error) {
      throw new BadRequestException('Failed to save transaction');
    }

    this.notificationsService.emit('notify_transaction_members', transaction);

    return transaction;
  }

  /* Update the transaction for the given transaction id with the provided information */
  async updateTransaction(
    transaction: number | Transaction,
    attrs: DeepPartial<Transaction>,
  ): Promise<Transaction> {
    if (!(transaction instanceof Transaction)) {
      transaction = await this.getTransactionById(transaction);
    }

    if (!transaction) throw new Error('Transaction not found');

    Object.assign(transaction, attrs);

    await this.repo.save(transaction);

    return transaction;
  }

  /* Remove the transaction for the given transaction id. */
  async removeTransaction(id: number, user: UserDto): Promise<boolean> {
    const transaction = await this.getTransactionById(id);

    if (!transaction) {
      throw new BadRequestException('Transaction not found');
    }

    if (transaction.creatorKey?.user?.id !== user.id) {
      throw new BadRequestException('Only the creator of the transaction is able to delete it');
    }

    await this.repo.softRemove(transaction);

    return true;
  }

  /* Gets the transaction with a status that are not expired */
  getTransactionsForUserWithStatus(
    user: User,
    status: TransactionStatus,
    take: number,
    skip: number,
  ) {
    return this.repo.find({
      where: {
        signers: {
          userId: user.id,
        },
        status,
        validStart: MoreThan(new Date(new Date().getTime() - 180 * 1_000)),
      },
      take,
      skip,
    });
  }

  /* Gets the count of transactions with a status that are not expired */
  getTransactionsForUserWithStatusCount(user: User, status: TransactionStatus) {
    return this.repo.count({
      where: {
        signers: {
          userId: user.id,
        },
        status,
        validStart: MoreThan(new Date(new Date().getTime() - 180 * 1_000)),
      },
    });
  }
}
