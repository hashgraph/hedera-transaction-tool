import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

import { PublicKey, Transaction as SDKTransaction, TransactionId } from '@hashgraph/sdk';

import {
  Repository,
  EntityManager,
  FindManyOptions,
  Brackets,
  In,
  Not,
  FindOptionsWhere,
  FindOperator,
} from 'typeorm';

import {
  NotificationType,
  Transaction,
  TransactionSigner,
  TransactionStatus,
  User,
} from '@entities';

import {
  CHAIN_SERVICE,
  NOTIFICATIONS_SERVICE,
  MirrorNodeService,
  encodeUint8Array,
  getClientFromNetwork,
  getTransactionTypeEnumValue,
  isExpired,
  notifyTransactionAction,
  Pagination,
  Sorting,
  Filtering,
  getWhere,
  getOrder,
  userKeysRequiredToSign,
  PaginatedResourceDto,
  attachKeys,
  notifyWaitingForSignatures,
  notifySyncIndicators,
  ErrorCodes,
  isTransactionBodyOverMaxSize,
  emitExecuteTransaction,
  notifyGeneral,
  SchedulerService,
  getTransactionSignReminderKey,
  safe,
  validateSignature,
  emitUpdateTransactionStatus,
} from '@app/common';

import { CreateTransactionDto, UploadSignatureMapDto, SignatureImportResultDto } from './dto';

import { ApproversService } from './approvers';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private repo: Repository<Transaction>,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
    @Inject(CHAIN_SERVICE) private readonly chainService: ClientProxy,
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly approversService: ApproversService,
    private readonly mirrorNodeService: MirrorNodeService,
    private readonly schedulerService: SchedulerService,
  ) {}

  /* Get the transaction for the provided id in the DATABASE */
  /* id can be number (ie internal id) or string (ie payerId@timestamp */
  async getTransactionById(id: number|TransactionId): Promise<Transaction> {
    if (!id) return null;

    const transaction = await this.repo.findOne({
      where:  typeof id == "number" ? { id } : { transactionId: id.toString() },
      relations: ['creatorKey', 'creatorKey.user', 'observers', 'comments', 'groupItem'],
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
        observers: {
          userId: user.id,
        },
      },
      {
        ...where,
        creatorKey: {
          userId: user.id,
        },
      },
    ];

    const findOptions: FindManyOptions<Transaction> = {
      where: whereForUser,
      order,
      relations: ['creatorKey', 'groupItem', 'groupItem.group'],
      skip: offset,
      take: limit,
    };

    const whereBrackets = new Brackets(qb =>
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
    );

    const [transactions, total] = await this.repo
      .createQueryBuilder()
      .setFindOptions(findOptions)
      .orWhere(whereBrackets)
      .getManyAndCount();

    return {
      totalItems: total,
      items: transactions,
      page,
      size,
    };
  }

  /* Get the transactions visible by the user */
  async getHistoryTransactions(
    { page, limit, size, offset }: Pagination,
    filter: Filtering[] = [],
    sort: Sorting[] = [],
  ): Promise<PaginatedResourceDto<Transaction>> {
    const order = getOrder(sort);

    const findOptions: FindManyOptions<Transaction> = {
      where: {
        ...getWhere<Transaction>(filter),
        status: this.getHistoryStatusWhere(filter),
      },
      order,
      relations: ['groupItem', 'groupItem.group'],
      skip: offset,
      take: limit,
    };

    const [transactions, total] = await this.repo
      .createQueryBuilder()
      .setFindOptions(findOptions)
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
    filter?: Filtering[],
  ): Promise<
    PaginatedResourceDto<{
      transaction: Transaction;
      keysToSign: number[];
    }>
  > {
    const where = getWhere<Transaction>(filter);
    const order = getOrder(sort);

    const whereForUser: FindOptionsWhere<Transaction> = {
      ...where,
      status: Not(
        In([
          TransactionStatus.EXECUTED,
          TransactionStatus.FAILED,
          TransactionStatus.EXPIRED,
          TransactionStatus.CANCELED,
          TransactionStatus.ARCHIVED,
        ]),
      ),
    };

    const result: {
      transaction: Transaction;
      keysToSign: number[];
    }[] = [];

    /* Ensures the user keys are passed */
    await attachKeys(user, this.entityManager);
    if (user.keys.length === 0) {
      return {
        totalItems: 0,
        items: [],
        page,
        size,
      };
    }

    const transactions = await this.repo.find({
      where: whereForUser,
      relations: ['groupItem'],
      order,
    });

    for (const transaction of transactions) {
      /* Check if the user should sign the transaction */
      try {
        const keysToSign = await this.userKeysToSign(transaction, user);
        if (keysToSign.length > 0) result.push({ transaction, keysToSign });
      } catch (error) {
        console.log(error);
      }
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

    const whereForUser: FindOptionsWhere<Transaction> = {
      ...where,
      status: Not(
        In([
          TransactionStatus.EXECUTED,
          TransactionStatus.FAILED,
          TransactionStatus.EXPIRED,
          TransactionStatus.CANCELED,
          TransactionStatus.ARCHIVED,
        ]),
      ),
    };

    const findOptions: FindManyOptions<Transaction> = {
      order,
      relations: {
        creatorKey: true,
        groupItem: true,
      },
      skip: offset,
      take: limit,
    };

    const [transactions, total] = await this.repo
      .createQueryBuilder()
      .setFindOptions(findOptions)
      .where(
        new Brackets(qb =>
          qb.where(whereForUser).andWhere(
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
  async createTransaction(dto: CreateTransactionDto, user: User): Promise<Transaction> {
    await attachKeys(user, this.entityManager);
    const creatorKey = user.keys.find(key => key.id === dto.creatorKeyId);
    const publicKey = PublicKey.fromString(creatorKey?.publicKey);

    /* Verify the signature matches the transaction */
    const validSignature = publicKey.verify(dto.transactionBytes, dto.signature);
    if (!validSignature) throw new BadRequestException(ErrorCodes.SNMP);

    /* Check if the transaction is expired */
    const sdkTransaction = SDKTransaction.fromBytes(dto.transactionBytes);
    if (isExpired(sdkTransaction)) throw new BadRequestException(ErrorCodes.TE);

    /* Check if the transaction body is over the max size */
    if (isTransactionBodyOverMaxSize(sdkTransaction)) {
      throw new BadRequestException(ErrorCodes.TOS);
    }

    /* Check if the transaction already exists */
    const countExisting = await this.repo.count({
      where: [
        {
          transactionId: sdkTransaction.transactionId.toString(),
          status: Not(
            In([
              TransactionStatus.CANCELED,
              TransactionStatus.REJECTED,
              TransactionStatus.ARCHIVED,
            ]),
          ),
        },
      ],
    });

    if (countExisting > 0) throw new BadRequestException(ErrorCodes.TEX);

    const client = await getClientFromNetwork(dto.mirrorNetwork);
    sdkTransaction.freezeWith(client);

    const transaction = this.repo.create({
      name: dto.name,
      type: getTransactionTypeEnumValue(sdkTransaction),
      description: dto.description,
      transactionId: sdkTransaction.transactionId.toString(),
      transactionHash: encodeUint8Array(await sdkTransaction.getTransactionHash()),
      transactionBytes: sdkTransaction.toBytes(),
      unsignedTransactionBytes: sdkTransaction.toBytes(),
      status: TransactionStatus.WAITING_FOR_SIGNATURES,
      creatorKey: {
        id: dto.creatorKeyId,
      },
      signature: dto.signature,
      mirrorNetwork: dto.mirrorNetwork,
      validStart: sdkTransaction.transactionId.validStart.toDate(),
      isManual: dto.isManual,
      cutoffAt: dto.cutoffAt,
    });
    client.close();

    try {
      await this.repo.save(transaction);
    } catch {
      throw new BadRequestException(ErrorCodes.FST);
    }

    if (dto.reminderMillisecondsBefore) {
      const remindAt = new Date(transaction.validStart.getTime() - dto.reminderMillisecondsBefore);
      this.schedulerService.addReminder(getTransactionSignReminderKey(transaction.id), remindAt);
    }
    notifyWaitingForSignatures(this.notificationsService, transaction.id, {
      transactionId: transaction.transactionId,
      network: transaction.mirrorNetwork,
    });
    notifyTransactionAction(this.notificationsService);

    return transaction;
  }

  async importSignatures(
    dto: UploadSignatureMapDto[],
    user: User,
  ): Promise<SignatureImportResultDto[]> {
    const results = new Set<SignatureImportResultDto>();
    for (const { id, signatureMap: map } of dto) {
      const transaction = await this.entityManager.findOne(Transaction, {
        where: { id },
        relations: ['creatorKey', 'approvers', 'signers', 'observers'],
      });

      try {
        /* Verify that the transaction exists and access is verified */
        if (!transaction || !(await this.verifyAccess(transaction, user))) {
          throw new BadRequestException(ErrorCodes.TNF);
        }

        /* Checks if the transaction is canceled */
        if (
          transaction.status !== TransactionStatus.WAITING_FOR_SIGNATURES &&
          transaction.status !== TransactionStatus.WAITING_FOR_EXECUTION
        )
          throw new BadRequestException(ErrorCodes.TNRS);

        /* Checks if the transaction is expired */
        const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);
        if (isExpired(sdkTransaction)) throw new BadRequestException(ErrorCodes.TE);

        /* Validates the signatures */
        const { data: publicKeys, error } = safe<PublicKey[]>(
          validateSignature.bind(this, sdkTransaction, map),
        );
        if (error) throw new BadRequestException(ErrorCodes.ISNMPN);

        for (const publicKey of publicKeys) {
          sdkTransaction.addSignature(publicKey, map);
        }

        await this.entityManager.update(
          Transaction,
          { id },
          { transactionBytes: sdkTransaction.toBytes() },
        );

        results.add({ id });
        emitUpdateTransactionStatus(this.chainService, id);
        notifyTransactionAction(this.notificationsService);
        notifySyncIndicators(this.notificationsService, id, transaction.status, {
          transactionId: transaction.transactionId,
          network: transaction.mirrorNetwork,
        });
      } catch (error) {
        results.add({
          id,
          error:
            (error instanceof BadRequestException || error instanceof UnauthorizedException)
              ? error.message
              : 'An unexpected error occurred while importing the signatures',
        });
      }
    }
    return [...results];
  }

  /* Remove the transaction for the given transaction id. */
  async removeTransaction(id: number, user: User, softRemove: boolean = true): Promise<boolean> {
    const transaction = await this.getTransactionForCreator(id, user);

    if (softRemove) {
      await this.repo.softRemove(transaction);
    } else {
      await this.repo.remove(transaction);
    }

    notifySyncIndicators(this.notificationsService, transaction.id, TransactionStatus.CANCELED, {
      transactionId: transaction.transactionId,
      network: transaction.mirrorNetwork,
    });
    notifyTransactionAction(this.notificationsService);

    return true;
  }

  /* Cancel the transaction if the valid start has not come yet. */
  async cancelTransaction(id: number, user: User): Promise<boolean> {
    const transaction = await this.getTransactionForCreator(id, user);

    if (
      ![
        TransactionStatus.NEW,
        TransactionStatus.WAITING_FOR_SIGNATURES,
        TransactionStatus.WAITING_FOR_EXECUTION,
      ].includes(transaction.status)
    ) {
      throw new BadRequestException(ErrorCodes.OTIP);
    }

    await this.repo.update({ id }, { status: TransactionStatus.CANCELED });

    notifySyncIndicators(this.notificationsService, transaction.id, TransactionStatus.CANCELED, {
      transactionId: transaction.transactionId,
      network: transaction.mirrorNetwork,
    });
    notifyTransactionAction(this.notificationsService);

    /* Send email notification to all the participants */
    await this.attachTransactionApprovers(transaction);
    const userIds = new Set<number>();
    transaction.approvers?.forEach(a => userIds.add(a.userId));
    transaction.signers?.forEach(s => userIds.add(s.userId));
    transaction.observers?.forEach(o => userIds.add(o.userId));

    notifyGeneral(
      this.notificationsService,
      NotificationType.TRANSACTION_CANCELLED,
      [...userIds],
      transaction.id,
      false,
      { transactionId: transaction.transactionId, network: transaction.mirrorNetwork },
    );

    return true;
  }

  /* Archive the transaction if the transaction is sign only. */
  async archiveTransaction(id: number, user: User): Promise<boolean> {
    const transaction = await this.getTransactionForCreator(id, user);

    if (
      ![TransactionStatus.WAITING_FOR_SIGNATURES, TransactionStatus.WAITING_FOR_EXECUTION].includes(
        transaction.status,
      ) &&
      !transaction.isManual
    ) {
      throw new BadRequestException(ErrorCodes.OMTIP);
    }

    await this.repo.update({ id }, { status: TransactionStatus.ARCHIVED });

    notifySyncIndicators(this.notificationsService, transaction.id, TransactionStatus.ARCHIVED, {
      transactionId: transaction.transactionId,
      network: transaction.mirrorNetwork,
    });
    notifyTransactionAction(this.notificationsService);

    return true;
  }

  /* Sends, or prepares, the transaction for execution if the transaction is manual. */
  async executeTransaction(id: number, user: User): Promise<boolean> {
    const transaction = await this.getTransactionForCreator(id, user);

    if (!transaction.isManual) {
      throw new BadRequestException(ErrorCodes.IO);
    }

    if (transaction.validStart.getTime() > Date.now()) {
      await this.repo.update({ id }, { isManual: false });
      notifyTransactionAction(this.notificationsService);
    } else {
      emitExecuteTransaction(this.chainService, {
        id: transaction.id,
        status: transaction.status,
        //@ts-expect-error - cannot send Buffer instance over the network
        transactionBytes: transaction.transactionBytes.toString('hex'),
        mirrorNetwork: transaction.mirrorNetwork,
        validStart: transaction.validStart,
      });
    }

    return true;
  }

  /* Get the transaction with the provided id if user has access */
  async getTransactionWithVerifiedAccess(transactionId: number|TransactionId, user: User) {
    const transaction = await this.getTransactionById(transactionId);

    await this.attachTransactionApprovers(transaction);

    if (!(await this.verifyAccess(transaction, user))) {
      throw new UnauthorizedException("You don't have permission to view this transaction");
    }
    return transaction;
  }

  async attachTransactionSigners(transaction: Transaction) {
    if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

    transaction.signers = await this.entityManager.find(TransactionSigner, {
      where: {
        transaction: {
          id: transaction.id,
        },
      },
      relations: ['userKey'],
      withDeleted: true,
    });
  }

  async attachTransactionApprovers(transaction: Transaction) {
    if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

    const approvers = await this.approversService.getApproversByTransactionId(transaction.id);
    transaction.approvers = this.approversService.getTreeStructure(approvers);
  }

  async verifyAccess(transaction: Transaction, user: User): Promise<boolean> {
    if (!transaction) throw new BadRequestException(ErrorCodes.TNF);

    if (
      [
        TransactionStatus.EXECUTED,
        TransactionStatus.EXPIRED,
        TransactionStatus.FAILED,
        TransactionStatus.CANCELED,
        TransactionStatus.ARCHIVED,
      ].includes(transaction.status)
    )
      return true;

    const userKeysToSign = await this.userKeysToSign(transaction, user);

    return (
      userKeysToSign.length !== 0 ||
      transaction.creatorKey?.userId === user.id ||
      transaction.observers?.some(o => o.userId === user.id) ||
      transaction.signers?.some(s => s.userKey?.userId === user.id) ||
      transaction.approvers?.some(a => a.userId === user.id)
    );
  }

  /* Check whether the user should approve the transaction */
  async shouldApproveTransaction(transactionId: number, user: User) {
    /* Get all the approvers */
    const approvers = await this.approversService.getApproversByTransactionId(transactionId);

    /* If user is approver, filter the records that belongs to the user */
    const userApprovers = approvers.filter(a => a.userId === user.id);

    /* Check if the user is an approver */
    if (userApprovers.length === 0) return false;

    /* Check if the user has already approved the transaction */
    return !userApprovers.every(a => a.signature);
  }

  /* Get the user keys that are required for a given transaction */
  userKeysToSign(transaction: Transaction, user: User) {
    return userKeysRequiredToSign(transaction, user, this.mirrorNodeService, this.entityManager);
  }

  async getTransactionForCreator(id: number, user: User) {
    const transaction = await this.getTransactionById(id);

    if (!transaction) {
      throw new BadRequestException(ErrorCodes.TNF);
    }

    if (transaction.creatorKey?.userId !== user?.id) {
      throw new UnauthorizedException('Only the creator has access to this transaction');
    }

    return transaction;
  }

  /* Get the status where clause for the history transactions */
  private getHistoryStatusWhere(
    filtering: Filtering[],
  ): TransactionStatus | FindOperator<TransactionStatus> {
    const allowedStatuses = [
      TransactionStatus.EXECUTED,
      TransactionStatus.FAILED,
      TransactionStatus.EXPIRED,
      TransactionStatus.CANCELED,
      TransactionStatus.ARCHIVED,
    ];
    const forbiddenStatuses = Object.values(TransactionStatus).filter(
      s => !allowedStatuses.includes(s),
    );

    if (!filtering || filtering.length === 0) return Not(In([...forbiddenStatuses]));

    const statusFilter = filtering.find(f => f.property === 'status');

    if (!statusFilter) return Not(In([...forbiddenStatuses]));

    const statusFilterValue = statusFilter.value
      .split(',')
      .map(v => v.trim()) as TransactionStatus[];

    switch (statusFilter.rule) {
      case 'eq':
        return allowedStatuses.includes(statusFilterValue[0])
          ? statusFilterValue[0]
          : Not(In([...forbiddenStatuses]));
      case 'in':
        return In(statusFilterValue.filter(s => allowedStatuses.includes(s)));
      case 'neq':
        return Not(In([...forbiddenStatuses, ...statusFilterValue]));
      case 'nin':
        return Not(
          In([...forbiddenStatuses, ...statusFilterValue.filter(s => allowedStatuses.includes(s))]),
        );
      default:
        return Not(In([...forbiddenStatuses]));
    }
  }
}
