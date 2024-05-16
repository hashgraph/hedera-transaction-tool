import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import {
  FileAppendTransaction,
  FileUpdateTransaction,
  PublicKey,
  Transaction as SDKTransaction,
} from '@hashgraph/sdk';

import { Repository, MoreThan, EntityManager, FindManyOptions, Brackets } from 'typeorm';

import { Transaction, TransactionSigner, TransactionStatus, User, UserKey } from '@entities';

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

import { ApproversService } from './approvers/approvers.service';
import { userKeysRequiredToSign } from '../utils';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private repo: Repository<Transaction>,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
    private readonly configService: ConfigService,
    private readonly approversService: ApproversService,
    private readonly mirrorNodeService: MirrorNodeService,
    @InjectEntityManager() private entityManager: EntityManager,
  ) {}

  /* Get the transaction for the provided id in the DATABASE */
  async getTransactionById(id: number): Promise<Transaction> {
    if (!id) return null;

    const transaction = await this.repo.findOne({
      where: { id },
      relations: ['creatorKey', 'creatorKey.user', 'observers', 'observers.user', 'comments'],
    });

    if (!transaction) return null;

    transaction.signers = await this.entityManager.find(TransactionSigner, {
      where: {
        transaction: {
          id: transaction.id,
        },
      },
      relations: {
        userKey: true,
      },
      withDeleted: true,
    });

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

    const findOptions: FindManyOptions<Transaction> = {
      where: whereForUser,
      order,
      relations: {
        creatorKey: true,
      },
      skip: offset,
      take: limit,
    };

    const [transactions, total] = await this.repo
      .createQueryBuilder()
      .setFindOptions(findOptions)
      .orWhere(
        new Brackets(qb =>
          qb.where(where).andWhere(
            `
            (
              with recursive "approverList" as
                (
                  select * from "transaction_approver"
                  where "transaction_approver"."transactionId" = "Transaction"."id"
                    union all
                      select "approver".* from "transaction_approver" as "approver"
                      join "approverList" on "approverList"."id" = "approver"."listId"
                )
              select count(*) from "approverList"
              where "approverList"."deletedAt" is null and "approverList"."userId" = :userId
            ) > 0
        `,
            {
              userId: user.id,
            },
          ),
        ),
      )
      .getManyAndCount();

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
      user.keys = await this.entityManager.find(UserKey, { where: { user: { id: user.id } } });
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
      const keysToSign = await this.userKeysToSign(transaction, user);

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

  /* Get the transactions that need to be approved by the user. */
  async getTransactionsToApprove(
    user: User,
    { page, limit, size, offset }: Pagination,
    sort?: Sorting[],
    filter?: Filtering[],
  ): Promise<PaginatedResourceDto<Transaction>> {
    const where = getWhere<Transaction>(filter);
    const order = getOrder(sort);

    const findOptions: FindManyOptions<Transaction> = {
      order,
      relations: {
        creatorKey: true,
      },
      skip: offset,
      take: limit,
    };

    const [transactions, total] = await this.repo
      .createQueryBuilder()
      .setFindOptions(findOptions)
      .where(
        new Brackets(qb =>
          qb.where(where).andWhere(
            `
            (
              with recursive "approverList" as
                (
                  select * from "transaction_approver"
                  where "transaction_approver"."transactionId" = "Transaction"."id"
                    union all
                      select "approver".* from "transaction_approver" as "approver"
                      join "approverList" on "approverList"."id" = "approver"."listId"
                )
              select count(*) from "approverList"
              where "approverList"."deletedAt" is null and "approverList"."userId" = :userId and "approverList"."approved" is null
            ) > 0
        `,
            {
              userId: user.id,
            },
          ),
        ),
      )
      .getManyAndCount();

    return {
      totalItems: total,
      items: transactions,
      page,
      size,
    };
  }

  /* Create a new transaction with the provided information */
  async createTransaction(dto: CreateTransactionDto, user: UserDto): Promise<Transaction> {
    const userKeys = await this.entityManager.find(UserKey, { where: { user: { id: user.id } } });
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

  /* Get the transaction with the provided id if user has access */
  async getTransactionWithVerifiedAccess(transactionId: number, user: User) {
    const transaction = await this.repo.findOne({
      where: { id: transactionId },
      relations: ['creatorKey', 'creatorKey.user', 'observers'],
    });

    if (!transaction) throw new NotFoundException('Transaction not found');

    transaction.signers = await this.entityManager.find(TransactionSigner, {
      where: {
        transaction: {
          id: transaction.id,
        },
      },
      relations: ['userKey', 'userKey.user'],
      withDeleted: true,
    });

    const userKeysToSign = await this.userKeysToSign(transaction, user);

    const approvers = await this.approversService.getApproversByTransactionId(transaction.id);

    transaction.approvers = this.approversService.getTreeStructure(approvers);

    if (
      userKeysToSign.length === 0 &&
      transaction.creatorKey?.user?.id !== user.id &&
      !transaction.observers.some(o => o.userId === user.id) &&
      !transaction.signers.some(s => s.userKey.user.id === user.id) &&
      !approvers.some(a => a.userId === user.id)
    )
      throw new UnauthorizedException("You don't have permission to view this transaction");

    return transaction;
  }

  /* Get the user keys that are required for a given transaction */
  userKeysToSign(transaction: Transaction, user: User) {
    return userKeysRequiredToSign(transaction, user, this.mirrorNodeService, this.entityManager);
  }
}
