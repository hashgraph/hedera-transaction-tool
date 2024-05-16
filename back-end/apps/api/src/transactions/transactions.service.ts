import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import {
  FileAppendTransaction,
  FileUpdateTransaction,
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
  Pagination,
  Sorting,
  Filtering,
  getWhere,
  getOrder,
  PaginatedResourceDto,
} from '@app/common';

import { UserDto } from '../users/dtos';
import { CreateTransactionDto } from './dto/create-transaction.dto';

import { UserKeysService } from '../user-keys/user-keys.service';
import { SignersService } from './signers/signers.service';
import { userKeysRequiredToSign } from '../utils';

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
        'observers.user',
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
      relations: [
        'creatorKey',
        'approvers',
        'observers',
        'observers.user',
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

  /* Get the transactions visible by the user */
  async getTransactions(
    user: User,
    { page, limit, size, offset }: Pagination,
    sort?: Sorting[],
    filter?: Filtering[],
  ): Promise<PaginatedResourceDto<Transaction>> {
    const where = getWhere<Transaction>(filter);
    const order = getOrder(sort);

    const whereForUser = [
      { ...where, signers: { userId: user.id } },
      {
        ...where,
        creatorKey: {
          user: {
            id: user.id,
          },
        },
      },
      {
        ...where,
        observers: {
          userId: user.id,
        },
      },
    ];

    const [transactions, total] = await this.repo.findAndCount({
      where: whereForUser,
      order,
      relations: {
        creatorKey: true,
      },
      skip: offset,
      take: limit,
    });

    return {
      totalItems: total,
      items: transactions,
      page,
      size,
    };
  }

  /* Get the transactions that a user needs to sign */
  async getTransactionsToSign(
    user: User,
    { page, limit, size, offset }: Pagination,
    sort?: Sorting[],
  ): Promise<
    PaginatedResourceDto<{
      transaction: Transaction;
      keysToSign: number[];
    }>
  > {
    let result: {
      transaction: Transaction;
      keysToSign: number[];
    }[] = [];

    /* Ensures the user keys are passed */
    if (user.keys.length === 0) {
      user.keys = await this.userKeysService.getUserKeys(user.id);
      if (user.keys.length === 0)
        return {
          totalItems: 0,
          items: [],
          page,
          size,
        };
    }

    const transactions = await this.repo.find({
      where: {
        status: TransactionStatus.WAITING_FOR_SIGNATURES,
        validStart: MoreThan(new Date(new Date().getTime() - 180 * 1_000)),
      },
    });

    for (const transaction of transactions) {
      /* Check if the user should sign the transaction */
      const keysToSign = await userKeysRequiredToSign(
        transaction,
        user,
        this.userKeysService,
        this.signersService,
        this.mirrorNodeService,
      );

      if (keysToSign.length > 0) result.push({ transaction, keysToSign });
    }

    if (sort && sort.length) {
      result = result.sort((a, b) => {
        for (const { property, direction } of sort) {
          if (a.transaction[property] < b.transaction[property])
            return direction === 'asc' ? -1 : 1;
          if (a.transaction[property] > b.transaction[property])
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return {
      totalItems: result.length,
      items: result.slice(offset, offset + limit),
      page,
      size,
    };
  }

  async userKeysToSign(transaction: Transaction, user: User): Promise<number[]> {
    return userKeysRequiredToSign(
      transaction,
      user,
      this.userKeysService,
      this.signersService,
      this.mirrorNodeService,
    );
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

  async verifyAccess(transactionId: number, user: User) {
    const transaction = await this.repo.findOne({
      where: { id: transactionId },
      relations: ['creatorKey', 'creatorKey.user', 'observers', 'approvers'],
    });

    if (!transaction) throw new NotFoundException('Transaction not found');

    if (
      !transaction.observers.some(o => o.userId === user.id) ||
      transaction.creatorKey?.user?.id !== user.id
      // || transaction.approvers.some(a => a. === user.id
    )
      throw new UnauthorizedException("You don't have permission to view this transaction");
  }
}
