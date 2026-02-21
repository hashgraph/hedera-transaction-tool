import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';

import {
  AccountUpdateTransaction,
  Client,
  Key,
  NodeCreateTransaction,
  NodeUpdateTransaction,
  PublicKey,
  Transaction as SDKTransaction,
  TransactionId,
} from '@hashgraph/sdk';

import {
  Brackets,
  EntityManager,
  FindManyOptions,
  FindOperator,
  FindOptionsWhere,
  In,
  Not,
  Repository,
} from 'typeorm';

import {
  Transaction,
  TransactionApprover,
  TransactionObserver,
  TransactionSigner,
  TransactionStatus,
  TransactionType,
  User,
} from '@entities';

import {
  attachKeys,
  emitTransactionStatusUpdate,
  emitTransactionUpdate,
  encodeUint8Array,
  ErrorCodes,
  ExecuteService,
  Filtering,
  getClientFromNetwork,
  getOrder,
  getTransactionSignReminderKey,
  getTransactionTypeEnumValue,
  getWhere,
  isExpired,
  isTransactionBodyOverMaxSize,
  NatsPublisherService,
  TransactionSignatureService,
  PaginatedResourceDto,
  Pagination,
  safe,
  SchedulerService,
  Sorting,
  userKeysRequiredToSign,
  validateSignature,
  flattenKeyList,
} from '@app/common';

import { CreateTransactionDto, SignatureImportResultDto, UploadSignatureMapDto } from './dto';

import { ApproversService } from './approvers';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction) private repo: Repository<Transaction>,
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly approversService: ApproversService,
    private readonly transactionSignatureService: TransactionSignatureService,
    private readonly schedulerService: SchedulerService,
    private readonly executeService: ExecuteService,
    private readonly notificationsPublisher: NatsPublisherService,
  ) {
  }

  /* Get the transaction for the provided id in the DATABASE */

  /* id can be number (ie internal id) or string (ie payerId@timestamp) */
  async getTransactionById(id: number | TransactionId): Promise<Transaction> {
    if (!id) return null;

    const transaction = await this.repo.findOne({
      where: typeof id == 'number' ? { id } : { transactionId: id.toString() },
      relations: [
        'creatorKey',
        'creatorKey.user',
        'observers',
        'comments',
        'groupItem',
        'groupItem.group',
      ],
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
    const [transaction] = await this.createTransactions([dto], user);

    emitTransactionStatusUpdate(
      this.notificationsPublisher,
      [{ entityId: transaction.id }],
    );

    return transaction;
  }

  async createTransactions(dtos: CreateTransactionDto[], user: User): Promise<Transaction[]> {
    if (dtos.length === 0) return [];

    await attachKeys(user, this.entityManager);

    const client = await getClientFromNetwork(dtos[0].mirrorNetwork);

    try {
      // Validate all DTOs upfront
      const validatedData = await Promise.all(
        dtos.map(dto => this.validateAndPrepareTransaction(dto, user, client)),
      );

      // Batch check for existing transactions
      const transactionIds = validatedData.map(v => v.transactionId);
      const existing = await this.repo.find({
        where: {
          transactionId: In(transactionIds),
          status: Not(
            In([
              TransactionStatus.CANCELED,
              TransactionStatus.REJECTED,
              TransactionStatus.ARCHIVED,
            ]),
          ),
        },
        select: ['transactionId'],
      });

      if (existing.length > 0) {
        throw new BadRequestException(
          `Transactions already exist: ${existing.map(t => t.transactionId).join(', ')}`,
        );
      }

      // Wrap database operations in transaction
      const savedTransactions = await this.entityManager.transaction(async (entityManager) => {
        const transactions = validatedData.map(data =>
          this.repo.create({
            name: data.name,
            type: data.type,
            description: data.description,
            transactionId: data.transactionId,
            transactionHash: data.transactionHash,
            transactionBytes: data.transactionBytes,
            unsignedTransactionBytes: data.unsignedTransactionBytes,
            status: TransactionStatus.WAITING_FOR_SIGNATURES,
            creatorKey: { id: data.creatorKeyId },
            signature: data.signature,
            mirrorNetwork: data.mirrorNetwork,
            validStart: data.validStart,
            isManual: data.isManual,
            cutoffAt: data.cutoffAt,
            publicKeys: data.publicKeys,
          }),
        );

        try {
          return await entityManager.save(Transaction, transactions);
        } catch (error) {
          throw new BadRequestException(ErrorCodes.FST);
        }
      });

      // Batch schedule reminders
      const reminderPromises = savedTransactions
        .map((tx, index) => {
          const dto = dtos[index];
          if (!dto.reminderMillisecondsBefore) return null;

          const remindAt = new Date(tx.validStart.getTime() - dto.reminderMillisecondsBefore);
          return this.schedulerService.addReminder(
            getTransactionSignReminderKey(tx.id),
            remindAt,
          );
        })
        .filter(Boolean);

      await Promise.all(reminderPromises);

      return savedTransactions;
    } catch (err) {
      // Preserve explicit BadRequestException, but annotate unexpected errors
      if (err instanceof BadRequestException) throw err;

      const PREFIX = 'An unexpected error occurred while creating transactions';
      const message = err instanceof Error && err.message ? `${PREFIX}: ${err.message}` : PREFIX;
      throw new BadRequestException(message);
    } finally {
      client.close();
    }
  }

  async importSignatures(
    dto: UploadSignatureMapDto[],
    user: User,
  ): Promise<SignatureImportResultDto[]> {
    type UpdateRecord = {
      id: number;
      transactionBytes: Buffer;
      transactionId: string;
      network: string;
    };

    const ids = dto.map(d => d.id);

    // Single batch query for all transactions
    const transactions = await this.entityManager.find(Transaction, {
      where: { id: In(ids) },
      relations: ['creatorKey', 'approvers', 'signers', 'observers'],
    });

    if (transactions.length === 0) {
      return ids.map(id => ({
        id,
        error: new BadRequestException(ErrorCodes.TNF).message,
      }));
    }

    // Create a map for quick lookup
    const transactionMap = new Map(transactions.map(t => [t.id, t]));

    const results = new Map<number, SignatureImportResultDto>();
    const updates = new Map<number, UpdateRecord>();

    for (const { id, signatureMap: map } of dto) {
      const transaction = transactionMap.get(id);

      try {
        /* Verify that the transaction exists and access is verified */
        if (!(await this.verifyAccess(transaction, user))) {
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

        transaction.transactionBytes = Buffer.from(sdkTransaction.toBytes());

        results.set(id, { id });
        updates.set(id, {
          id,
          transactionBytes: transaction.transactionBytes,
          transactionId: transaction.transactionId,
          network: transaction.mirrorNetwork,
        });
      } catch (error) {
        results.set(id, {
          id,
          error:
            (error instanceof BadRequestException)
              ? error.message
              : 'An unexpected error occurred while importing the signatures',
        });
      }
    }

    //Added a batch mechanism, probably should limit this on the api side of things
    const BATCH_SIZE = 500;

    const updateArray = Array.from(updates.values());

    if (updateArray.length > 0) {
      for (let i = 0; i < updateArray.length; i += BATCH_SIZE) {
        const batch = updateArray.slice(i, i + BATCH_SIZE);

        let caseSQL = 'CASE id ';
        const params: any = {};

        batch.forEach((update, idx) => {
          caseSQL += `WHEN :id${idx} THEN :bytes${idx}::bytea `;
          params[`id${idx}`] = update.id;
          params[`bytes${idx}`] = update.transactionBytes;
        });
        caseSQL += 'END';

        try {
          await this.entityManager
            .createQueryBuilder()
            .update(Transaction)
            .set({ transactionBytes: () => caseSQL })
            .where('id IN (:...ids)', { ids: batch.map(u => u.id) })
            .setParameters(params)
            .execute();

          // mark each update in the batch as succeeded
          batch.forEach(u => results.set(u.id, { id: u.id }));
        } catch (err) {
          const SAVE_ERROR_PREFIX = 'An unexpected error occurred while saving the signatures';
          const message =
            err instanceof Error && err.message
              ? `${SAVE_ERROR_PREFIX}: ${err.message}`
              : SAVE_ERROR_PREFIX;

          batch.forEach(u => results.set(u.id, { id: u.id, error: message }));
        }
      }

      emitTransactionStatusUpdate(
        this.notificationsPublisher,
        updateArray.map(r => ({
          entityId: r.id,
          additionalData: { transactionId: r.transactionId, network: r.network },
        })),
      );
    }

    return Array.from(results.values());
  }

  /* Remove the transaction for the given transaction id. */
  async removeTransaction(id: number, user: User, softRemove: boolean = true): Promise<boolean> {
    const transaction = await this.getTransactionForCreator(id, user);

    if (softRemove) {
      await this.repo.update(transaction.id, { status: TransactionStatus.CANCELED });
      await this.repo.softRemove(transaction);
    } else {
      await this.repo.remove(transaction);
    }

    emitTransactionStatusUpdate(
      this.notificationsPublisher,
      [{
        entityId: transaction.id,
        additionalData: {
          transactionId: transaction.transactionId,
          network: transaction.mirrorNetwork,
        },
      }],
    );

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

    emitTransactionStatusUpdate(
      this.notificationsPublisher,
      [{
        entityId: id,
        additionalData: {
          transactionId: transaction.transactionId,
          network: transaction.mirrorNetwork,
        },
      }],
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
    emitTransactionStatusUpdate(
      this.notificationsPublisher,
      [{
        entityId: transaction.id,
        additionalData: {
          transactionId: transaction.transactionId,
          network: transaction.mirrorNetwork,
        },
      }],
    );

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
      emitTransactionUpdate(this.notificationsPublisher, [{ entityId: transaction.id }]);
    } else {
      await this.executeService.executeTransaction(transaction);
    }

    return true;
  }

  /* Get the transaction with the provided id if user has access */
  async getTransactionWithVerifiedAccess(transactionId: number | TransactionId, user: User) {
    const transaction = await this.getTransactionById(transactionId);

    await this.attachTransactionApprovers(transaction);

    if (!(await this.verifyAccess(transaction, user))) {
      throw new UnauthorizedException('You don\'t have permission to view this transaction');
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

    const userKeysToSign = await this.userKeysToSign(transaction, user, true);

    return (
      userKeysToSign.length !== 0 ||
      transaction.creatorKey?.userId === user.id ||
      !!transaction.observers?.some(o => o.userId === user.id) ||
      !!transaction.signers?.some(s => s.userKey?.userId === user.id) ||
      !!transaction.approvers?.some(a => a.userId === user.id)
    );
  }

  async getTransactionSignersForTransactions(
    transactionIds: number[]
  ): Promise<TransactionSigner[]> {
    if (!transactionIds.length) return [];

    return this.entityManager.find(TransactionSigner, {
      where: {
        transactionId: In(transactionIds),
      },
      relations: ['userKey'],
      withDeleted: true,
    });
  }

  async getTransactionApproversForTransactions(
    transactionIds: number[],
  ): Promise<TransactionApprover[]> {
    if (!transactionIds.length) {
      return [];
    }

    //To be implemented when approver functionality is added.
    return [];
  }

  async getTransactionObserversForTransactions(
    transactionIds: number[],
  ): Promise<TransactionObserver[]> {
    if (!transactionIds.length) {
      return [];
    }

    return this.entityManager.find(TransactionObserver, {
      where: {
        transactionId: In(transactionIds),
      },
    });
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
  async userKeysToSign(transaction: Transaction, user: User, showAll: boolean = false) {
    return userKeysRequiredToSign(transaction, user, this.transactionSignatureService, this.entityManager, showAll);
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

  /**
   * Validate and prepare a single transaction
   */
  private async validateAndPrepareTransaction(
    dto: CreateTransactionDto,
    user: User,
    client: Client,
  ) {
    const creatorKey = user.keys.find(key => key.id === dto.creatorKeyId);

    if (!creatorKey) {
      throw new BadRequestException(`Creator key ${dto.creatorKeyId} not found`);
    }

    const publicKey = PublicKey.fromString(creatorKey.publicKey);

    // Verify signature
    const validSignature = publicKey.verify(dto.transactionBytes, dto.signature);
    if (!validSignature) {
      throw new BadRequestException(ErrorCodes.SNMP);
    }

    // Parse SDK transaction
    const sdkTransaction = SDKTransaction.fromBytes(dto.transactionBytes);

    // Check if expired
    if (isExpired(sdkTransaction)) {
      throw new BadRequestException(ErrorCodes.TE);
    }

    // Check size
    if (isTransactionBodyOverMaxSize(sdkTransaction)) {
      throw new BadRequestException(ErrorCodes.TOS);
    }

    // Freeze transaction with shared client
    sdkTransaction.freezeWith(client);

    const transactionHash = await sdkTransaction.getTransactionHash();
    const transactionType = getTransactionTypeEnumValue(sdkTransaction);

    // Extract new keys if applicable
    let publicKeys: string[] | null = null;
    try {
      let keyToExtract: Key | null = null;

      if (transactionType === TransactionType.ACCOUNT_UPDATE) {
        keyToExtract = (sdkTransaction as AccountUpdateTransaction).key;
      } else if (transactionType === TransactionType.NODE_UPDATE) {
        keyToExtract = (sdkTransaction as NodeUpdateTransaction).adminKey;
      } else if (transactionType === TransactionType.NODE_CREATE) {
        keyToExtract = (sdkTransaction as NodeCreateTransaction).adminKey;
      }

      if (keyToExtract) {
        publicKeys = flattenKeyList(keyToExtract).map(pk => pk.toStringRaw());
      }
    } catch (error) {
      // Log but don't fail - publicKeys will remain null
      console.error(`Failed to extract public keys from transaction ${sdkTransaction.transactionId}:`, error);
    }

    return {
      name: dto.name,
      type: transactionType,
      description: dto.description,
      transactionId: sdkTransaction.transactionId.toString(),
      transactionHash: encodeUint8Array(transactionHash),
      transactionBytes: sdkTransaction.toBytes(),
      unsignedTransactionBytes: sdkTransaction.toBytes(),
      creatorKeyId: dto.creatorKeyId,
      signature: dto.signature,
      mirrorNetwork: dto.mirrorNetwork,
      validStart: sdkTransaction.transactionId.validStart.toDate(),
      isManual: dto.isManual,
      cutoffAt: dto.cutoffAt,
      publicKeys,
    };
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
