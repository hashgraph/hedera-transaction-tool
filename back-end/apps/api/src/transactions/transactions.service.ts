import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectEntityManager, InjectRepository } from '@nestjs/typeorm';

import {
  Client,
  PublicKey,
  Transaction as SDKTransaction,
  TransactionId,
} from '@hiero-ledger/sdk';

import {
  ArrayOverlap,
  Brackets,
  DataSource,
  EntityManager,
  FindManyOptions,
  FindOptionsWhere,
  In,
  Not,
  Repository,
} from 'typeorm';

import {
  type NewSignerRow,
  Transaction,
  TransactionApprover,
  TransactionObserver,
  TransactionSigner,
  TransactionStatus,
  User,
  UserKey,
} from '@entities';

import {
  attachKeys,
  emitDismissedNotifications,
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
  processTransactionStatus,
  safe,
  SchedulerService,
  Sorting,
  userKeysRequiredToSign,
  validateSignature,
  flattenKeyList,
  getNodeAccountIdsFromClientNetwork,
  isTransactionValidForNodes,
  TransactionSnapshotService,
} from '@app/common';

import TransactionFactory from '@app/common/transaction-signature/model/transaction-factory';

import { CreateTransactionDto, SignatureImportResultDto, UploadSignatureMapDto } from './dto';

import { ApproversService } from './approvers';

export enum CancelTransactionOutcome {
  CANCELED = 'CANCELED',
  ALREADY_CANCELED = 'ALREADY_CANCELED',
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction) private repo: Repository<Transaction>,
    @InjectEntityManager() private entityManager: EntityManager,
    @InjectDataSource() private dataSource: DataSource,
    private readonly approversService: ApproversService,
    private readonly transactionSignatureService: TransactionSignatureService,
    private readonly schedulerService: SchedulerService,
    private readonly executeService: ExecuteService,
    private readonly notificationsPublisher: NatsPublisherService,
    private readonly transactionSnapshotService: TransactionSnapshotService,
  ) {
  }

  private readonly cancelableStatuses = [
    TransactionStatus.NEW,
    TransactionStatus.WAITING_FOR_SIGNATURES,
    TransactionStatus.WAITING_FOR_EXECUTION,
  ];

  private readonly terminalStatuses = [
    TransactionStatus.EXECUTED,
    TransactionStatus.EXPIRED,
    TransactionStatus.FAILED,
    TransactionStatus.CANCELED,
    TransactionStatus.ARCHIVED,
    TransactionStatus.REJECTED,
  ];

  /* Get the transaction for the provided id in the DATABASE */

  /* id can be number (ie internal id) or string (ie payerId@timestamp) */
  async getTransactionById(id: number | TransactionId): Promise<Transaction> {
    if (!id) return null;

    const transactions = await this.repo.find({
      where: typeof id == 'number' ? { id } : { transactionId: id.toString() },
      relations: [
        'creatorKey',
        'creatorKey.user',
        'observers',
        'comments',
        'groupItem',
        'groupItem.group',
      ],
      order: { id: 'DESC' },
    });

    if (!transactions.length) return null;

    const inactiveStatuses = [TransactionStatus.CANCELED, TransactionStatus.REJECTED, TransactionStatus.ARCHIVED];

    const transaction =
      transactions.find(t => !inactiveStatuses.includes(t.status)) ??
      transactions[0]; // most recent, since ordered by id DESC

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
    user: User,
    { page, limit, size, offset }: Pagination,
    filter: Filtering[] = [],
    sort: Sorting[] = [],
  ): Promise<PaginatedResourceDto<Transaction>> {
    const order = getOrder(sort);

    await attachKeys(user, this.entityManager);

    const { bypassStatuses, nonBypassStatuses } = this.getHistoryStatusBuckets(filter);

    // Strip status from baseWhere — each branch sets its own status condition.
    const baseWhere = getWhere<Transaction>(filter.filter(f => f.property !== 'status'));

    const whereArray: FindOptionsWhere<Transaction>[] = [];

    // EXECUTED and FAILED: submitted to the network, visible to everyone.
    if (bypassStatuses.length > 0) {
      whereArray.push({ ...baseWhere, status: In(bypassStatuses) });
    }

    // EXPIRED, CANCELED, ARCHIVED: require user association.
    if (nonBypassStatuses.length > 0) {
      const statusClause = In(nonBypassStatuses);
      const userPublicKeys = user.keys?.map(k => k.publicKey) ?? [];

      whereArray.push(
        { ...baseWhere, status: statusClause, creatorKey: { userId: user.id } },
        { ...baseWhere, status: statusClause, observers: { userId: user.id } },
        { ...baseWhere, status: statusClause, signers: { userId: user.id } },
      );

      if (userPublicKeys.length > 0) {
        whereArray.push(
          {
            ...baseWhere,
            status: statusClause,
            transactionCachedAccounts: { cachedAccount: { keys: { publicKey: In(userPublicKeys) } } },
          },
          {
            ...baseWhere,
            status: statusClause,
            transactionCachedNodes: { cachedNode: { keys: { publicKey: In(userPublicKeys) } } },
          },
          // Branch 3: user's key is directly listed in the transaction's publicKeys array
          {
            ...baseWhere,
            status: statusClause,
            publicKeys: ArrayOverlap(userPublicKeys),
          },
        );
      }
    }

    if (whereArray.length === 0) {
      return { totalItems: 0, items: [], page, size };
    }

    const [transactions, total] = await this.repo.findAndCount({
      where: whereArray,
      order,
      relations: ['groupItem', 'groupItem.group'],
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
  /** @deprecated use transaction-nodes' getTransactionNodes instead */
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
        const keysToSign = await this.getUserKeysToSign(transaction, user);
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
        this.logger.warn(
          `Duplicate transaction IDs rejected: ${existing.map(t => t.transactionId).join(', ')}`,
        );
        throw new BadRequestException(ErrorCodes.TEX);
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
          this.logger.error('Failed to save transactions', (error as any)?.stack ?? (error as any)?.message ?? String(error));
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
    version: string | null = null,
  ): Promise<SignatureImportResultDto[]> {
    type UpdateRecord = {
      id: number;
      transactionBytes: Buffer;
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

    const transactionMap = new Map(transactions.map(t => [t.id, t]));

    const existingSigners = await this.entityManager.find(TransactionSigner, {
      where: { transactionId: In(ids) },
      select: ['transactionId', 'userKeyId'],
    });
    const signersByTransaction = new Map<number, Set<number>>();
    for (const s of existingSigners) {
      let set = signersByTransaction.get(s.transactionId);
      if (!set) {
        set = new Set<number>();
        signersByTransaction.set(s.transactionId, set);
      }
      set.add(s.userKeyId);
    }

    const results = new Map<number, SignatureImportResultDto>();
    const updates = new Map<number, UpdateRecord>();
    const newSignerRows: NewSignerRow[] = [];
    const notificationDismissals: { userId: number; transactionId: number }[] = [];
    // Dedups (userId, txId) so one user with multiple keys produces one UNNEST row.
    const notificationDismissalKeys = new Set<string>();
    // DTOs with persistable side-effects; drives status recompute + NATS emission.
    const transactionsToProcess = new Map<number, Transaction>();

    type DtoIntermediate = {
      transaction: Transaction;
      publicKeys: PublicKey[];
      newBytes: Buffer;
      isSameBytes: boolean;
      tool: string | null;
    };
    const intermediate = new Map<number, DtoIntermediate>();
    const allPubKeyStrings = new Set<string>();

    // Two-pass: defer UserKey resolution to a single bulk find below (was N+1).
    for (const { id, signatureMap: map, tool } of dto) {
      const transaction = transactionMap.get(id);

      try {
        if (!(await this.verifyAccess(transaction, user))) {
          throw new BadRequestException(ErrorCodes.TNF);
        }

        if (
          transaction.status !== TransactionStatus.WAITING_FOR_SIGNATURES &&
          transaction.status !== TransactionStatus.WAITING_FOR_EXECUTION
        )
          throw new BadRequestException(ErrorCodes.TNRS);

        const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);
        if (isExpired(sdkTransaction)) throw new BadRequestException(ErrorCodes.TE);

        // Verify ALL signatures (including already-signed keys); returns only (deduped) keys
        // not already on the transaction. Throws if any signature is invalid.
        const { data: validResult, error } = safe<ReturnType<typeof validateSignature>>(
          validateSignature.bind(this, sdkTransaction, map),
        );
        const validNewKeys = validResult?.newPublicKeys ?? [];
        if (error) throw new BadRequestException(ErrorCodes.ISNMPN);

        for (const publicKey of validNewKeys) {
          sdkTransaction.addSignature(publicKey, map);
        }

        const originalBytes = transaction.transactionBytes;
        const newBytes = Buffer.from(sdkTransaction.toBytes());
        const isSameBytes = newBytes.equals(originalBytes);

        for (const pk of validNewKeys) {
          allPubKeyStrings.add(pk.toStringRaw());
          allPubKeyStrings.add(pk.toStringDer());
        }

        intermediate.set(id, { transaction, publicKeys: validNewKeys, newBytes, isSameBytes, tool: tool ?? 'api' });
      } catch (error) {
        if (!(error instanceof BadRequestException)) {
          this.logger.error(`[TX ${id}] Unexpected error during signature import`, (error as any)?.stack ?? (error as any)?.message ?? String(error));
        }
        results.set(id, {
          id,
          error:
            (error instanceof BadRequestException)
              ? error.message
              : 'An unexpected error occurred while importing the signatures',
        });
      }
    }

    // Soft-deleted UserKeys excluded by default — a revoked key must not regain
    // signer access via a historical import. Buckets are arrays because
    // UserKey.publicKey is indexed but not unique (users can share a key).
    const userKeysByPublicKey = new Map<string, UserKey[]>();
    if (allPubKeyStrings.size > 0) {
      const userKeys = await this.entityManager.find(UserKey, {
        where: { publicKey: In([...allPubKeyStrings]) },
      });
      for (const uk of userKeys) {
        const bucket = userKeysByPublicKey.get(uk.publicKey);
        if (bucket) bucket.push(uk);
        else userKeysByPublicKey.set(uk.publicKey, [uk]);
      }
    }

    for (const [id, { transaction, publicKeys, newBytes, isSameBytes, tool }] of intermediate) {
      // Create TransactionSigner rows for any keys found in the imported signatures (issue #2552).
      const newSignersForDto: NewSignerRow[] = [];
      if (publicKeys.length > 0) {
        let txExistingSigners = signersByTransaction.get(id);
        if (!txExistingSigners) {
          txExistingSigners = new Set<number>();
          signersByTransaction.set(id, txExistingSigners);
        }
        for (const pk of publicKeys) {
          const matches = [
            ...(userKeysByPublicKey.get(pk.toStringRaw()) ?? []),
            ...(userKeysByPublicKey.get(pk.toStringDer()) ?? []),
          ];
          for (const uk of matches) {
            if (txExistingSigners.has(uk.id)) continue;
            txExistingSigners.add(uk.id);
            newSignersForDto.push({ userId: uk.userId, transactionId: id, userKeyId: uk.id, recorderId: user.id, tool, version });
          }
        }
      }

      // Skip duplicate imports so we don't emit spurious status-update events.
      if (isSameBytes && newSignersForDto.length === 0) {
        results.set(id, { id });
        continue;
      }

      if (!isSameBytes) {
        transaction.transactionBytes = newBytes;
        updates.set(id, {
          id,
          transactionBytes: newBytes,
        });
      }

      for (const row of newSignersForDto) {
        newSignerRows.push(row);
        const dismissalKey = `${row.userId}:${id}`;
        if (!notificationDismissalKeys.has(dismissalKey)) {
          notificationDismissalKeys.add(dismissalKey);
          notificationDismissals.push({ userId: row.userId, transactionId: id });
        }
      }

      transactionsToProcess.set(id, transaction);
    }

    const BATCH_SIZE = 500;
    const updateArray = Array.from(updates.values());
    let dismissedRows: Array<{ id: number; userId: number }> = [];
    let committed = false;

    // Bytes + signer rows + dismissals must commit together atomically.
    if (updateArray.length > 0 || newSignerRows.length > 0) {
      try {
        await this.dataSource.transaction(async manager => {
          if (updateArray.length > 0) {
            for (let i = 0; i < updateArray.length; i += BATCH_SIZE) {
              const batch = updateArray.slice(i, i + BATCH_SIZE);

              let caseSQL = 'CASE id ';
              const params: Record<string, unknown> = {};

              batch.forEach((update, idx) => {
                caseSQL += `WHEN :id${idx} THEN :bytes${idx}::bytea `;
                params[`id${idx}`] = update.id;
                params[`bytes${idx}`] = update.transactionBytes;
              });
              caseSQL += 'END';

              await manager
                .createQueryBuilder()
                .update(Transaction)
                .set({ transactionBytes: () => caseSQL, updatedAt: () => 'NOW()' })
                .where('id IN (:...ids)', { ids: batch.map(u => u.id) })
                .setParameters(params)
                .execute();
            }
          }

          if (newSignerRows.length > 0) {
            await manager
              .createQueryBuilder()
              .insert()
              .into(TransactionSigner)
              .values(newSignerRows)
              .execute();
          }

          if (notificationDismissals.length > 0) {
            const userIds = notificationDismissals.map(n => n.userId);
            const txIds = notificationDismissals.map(n => n.transactionId);
            const [rows] = await manager.query(
              `
              WITH input(user_id, tx_id) AS (
                SELECT * FROM UNNEST($1::int[], $2::int[])
              )
              UPDATE notification_receiver nr
              SET "isRead" = true,
                  "updatedAt" = NOW()
              FROM notification n, input i
              WHERE nr."notificationId" = n.id
                AND n.type = 'TRANSACTION_INDICATOR_SIGN'
                AND i.tx_id = n."entityId"
                AND i.user_id = nr."userId"
                AND nr."isRead" = false
              RETURNING nr.id, nr."userId"
              `,
              [userIds, txIds],
            );
            if (Array.isArray(rows)) {
              dismissedRows = rows;
            }
          }
        });
        committed = true;

        for (const id of transactionsToProcess.keys()) {
          results.set(id, { id });
        }
      } catch (err) {
        this.logger.error(
          'Failed to persist imported signatures atomically',
          err instanceof Error ? err.stack : String(err),
        );
        const message = ErrorCodes.FST;
        for (const id of transactionsToProcess.keys()) {
          results.set(id, { id, error: message });
        }
        transactionsToProcess.clear();
        dismissedRows = [];
      }
    }

    if (dismissedRows.length > 0) {
      emitDismissedNotifications(this.notificationsPublisher, dismissedRows);
    }

    // Status recompute runs only after commit; rollback path clears transactionsToProcess.
    if (committed && transactionsToProcess.size > 0) {
      let statusMap = new Map<number, TransactionStatus>();
      try {
        const result = await processTransactionStatus(
          this.repo,
          this.transactionSignatureService,
          Array.from(transactionsToProcess.values()),
        );
        if (result) statusMap = result;
      } catch (err) {
        this.logger.error(
          'processTransactionStatus failed on import',
          err instanceof Error ? err.stack : String(err),
        );
      }

      // Payload shape mirrors SignersService.updateStatusesAndNotify for NATS consumers.
      const changed: number[] = [];
      const unchanged: number[] = [];
      for (const id of transactionsToProcess.keys()) {
        if (statusMap.has(id)) {
          changed.push(id);
        } else {
          unchanged.push(id);
        }
      }

      if (changed.length > 0) {
        emitTransactionStatusUpdate(
          this.notificationsPublisher,
          changed.map(id => ({ entityId: id })),
        );
      }
      if (unchanged.length > 0) {
        emitTransactionUpdate(
          this.notificationsPublisher,
          unchanged.map(id => ({ entityId: id })),
        );
      }
    }

    return Array.from(results.values());
  }

  async removeTransaction(id: number, user: User, softRemove: boolean = true): Promise<boolean> {
    const transaction = await this.getTransactionForCreator(id, user);

    if (softRemove) {
      const executedAt = new Date();
      await this.repo.update(transaction.id, { status: TransactionStatus.CANCELED, executedAt });
      await this.transactionSnapshotService.captureForTransaction(transaction.id, executedAt);
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
    await this.cancelTransactionWithOutcome(id, user);
    return true;
  }

  async cancelTransactionWithOutcome(
    id: number,
    user: User,
  ): Promise<CancelTransactionOutcome> {
    const transaction = await this.getTransactionForCreator(id, user);

    if (transaction.status === TransactionStatus.CANCELED) {
      return CancelTransactionOutcome.ALREADY_CANCELED;
    }

    if (!this.cancelableStatuses.includes(transaction.status)) {
      throw new BadRequestException(ErrorCodes.OTIP);
    }

    const executedAt = new Date();
    const updateResult = await this.repo
      .createQueryBuilder()
      .update(Transaction)
      .set({ status: TransactionStatus.CANCELED, executedAt })
      .where('id = :id', { id })
      .andWhere('status IN (:...statuses)', { statuses: this.cancelableStatuses })
      .execute();

    if (updateResult.affected && updateResult.affected > 0) {
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
      await this.transactionSnapshotService.captureForTransaction(id, executedAt);

      return CancelTransactionOutcome.CANCELED;
    }

    // Race-safe fallback: state changed between read and update, so re-check current status.
    const latestTransaction = await this.getTransactionForCreator(id, user);
    if (latestTransaction.status === TransactionStatus.CANCELED) {
      return CancelTransactionOutcome.ALREADY_CANCELED;
    }
    if (!this.cancelableStatuses.includes(latestTransaction.status)) {
      throw new BadRequestException(ErrorCodes.OTIP);
    }
    throw new ConflictException('Cancellation conflict');
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

    const executedAt = new Date();
    await this.repo.update({ id }, { status: TransactionStatus.ARCHIVED, executedAt });
    await this.transactionSnapshotService.captureForTransaction(id, executedAt);
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
        TransactionStatus.FAILED,
      ].includes(transaction.status)
    )
      return true;

    const requiredKeyIds = await this.getUserKeysToSign(transaction, user, true);

    return (
      requiredKeyIds.length !== 0 ||
      transaction.creatorKey?.userId === user.id ||
      !!transaction.observers?.some(o => o.userId === user.id) ||
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
    const transaction = await this.getTransactionById(transactionId);
    if (!transaction) {
      throw new BadRequestException(ErrorCodes.TNF);
    }

    if (this.terminalStatuses.includes(transaction.status)) {
      return false;
    }

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
  async getUserKeysToSign(transaction: Transaction, user: User, showAll: boolean = false): Promise<number[]> {
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

    // Check the transaction is frozen, cannot require it to be frozen, breaks backwards compatibility
    if (!sdkTransaction.isFrozen()) {
      sdkTransaction.freezeWith(client);
    }

    // Check if expired
    if (isExpired(sdkTransaction)) {
      throw new BadRequestException(ErrorCodes.TE);
    }

    // Check size
    if (isTransactionBodyOverMaxSize(sdkTransaction)) {
      throw new BadRequestException(ErrorCodes.TOS);
    }

    // Check nodes
    const allowedNodes = getNodeAccountIdsFromClientNetwork(client);
    if (!isTransactionValidForNodes(sdkTransaction, allowedNodes)) {
      throw new BadRequestException(ErrorCodes.TNVN);
    }

    const transactionHash = await sdkTransaction.getTransactionHash();
    const transactionType = getTransactionTypeEnumValue(sdkTransaction);

    // Extract the public keys of any "new key" the transaction is introducing
    // (e.g. the new account/admin key) so the notification subsystem can route
    // sign requests to the right users. The rule for what counts as a new key
    // is owned by each transaction model's `getNewKeys()` — adding a new type
    // therefore only requires registering a model in TransactionFactory, not
    // editing this service.
    let publicKeys: string[] | null = null;
    try {
      const newKeys = TransactionFactory.fromTransaction(sdkTransaction).getNewKeys();
      if (newKeys.length > 0) {
        publicKeys = newKeys.flatMap(k => flattenKeyList(k).map(pk => pk.toStringRaw()));
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

  /* Splits the status filter into bypass (EXECUTED/FAILED) and non-bypass buckets. */
  private getHistoryStatusBuckets(filtering: Filtering[]): {
    bypassStatuses: TransactionStatus[];
    nonBypassStatuses: TransactionStatus[];
  } {
    const bypassGroup = [TransactionStatus.EXECUTED, TransactionStatus.FAILED];
    const nonBypassGroup = [TransactionStatus.EXPIRED, TransactionStatus.CANCELED, TransactionStatus.ARCHIVED];
    const allHistoryStatuses = [...bypassGroup, ...nonBypassGroup];

    const statusFilter = filtering?.find(f => f.property === 'status');

    let allowed = allHistoryStatuses;

    if (statusFilter) {
      const values = statusFilter.value.split(',').map(v => v.trim()) as TransactionStatus[];
      const validValues = values.filter(s => allHistoryStatuses.includes(s));

      switch (statusFilter.rule) {
        case 'eq':
          allowed = allHistoryStatuses.includes(values[0]) ? [values[0]] : allHistoryStatuses;
          break;
        case 'in':
          allowed = validValues;
          break;
        case 'neq':
          allowed = allHistoryStatuses.filter(s => !values.includes(s));
          break;
        case 'nin':
          allowed = allHistoryStatuses.filter(s => !validValues.includes(s));
          break;
        default:
          // keep all
      }
    }

    return {
      bypassStatuses: allowed.filter(s => bypassGroup.includes(s)),
      nonBypassStatuses: allowed.filter(s => nonBypassGroup.includes(s)),
    };
  }
}
