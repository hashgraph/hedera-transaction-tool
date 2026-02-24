import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, In, Repository } from 'typeorm';
import { PublicKey, SignatureMap, Transaction as SDKTransaction } from '@hashgraph/sdk';

import {
  emitDismissedNotifications,
  emitTransactionStatusUpdate,
  emitTransactionUpdate,
  ErrorCodes,
  isExpired,
  NatsPublisherService,
  PaginatedResourceDto,
  Pagination,
  processTransactionStatus,
  TransactionSignatureService,
} from '@app/common';
import { Transaction, TransactionSigner, TransactionStatus, User, UserKey } from '@entities';

import { UploadSignatureMapDto } from '../dto';

@Injectable()
export class SignersService {
  constructor(
    @InjectRepository(TransactionSigner)
    private repo: Repository<TransactionSigner>,
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,
    @InjectDataSource() private dataSource: DataSource,
    private readonly notificationsPublisher: NatsPublisherService,
    private readonly transactionSignatureService: TransactionSignatureService,
  ) {}

  /* Get the signature for the given signature id */
  getSignatureById(id: number): Promise<TransactionSigner | null> {
    if (!id) {
      return null;
    }
    return this.repo.findOne({
      where: { id },
      withDeleted: true,
    });
  }

  /* Get the signatures that a user has given */
  async getSignaturesByUser(
    user: User,
    { limit, offset, page, size }: Pagination,
    withDeleted: boolean = false,
  ): Promise<PaginatedResourceDto<TransactionSigner>> {
    if (!user) return null;

    const [items, totalItems] = await this.repo.findAndCount({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        transactionId: true,
        userKeyId: true,
        createdAt: true,
      },
      withDeleted,
      skip: offset,
      take: limit,
    });

    return {
      totalItems,
      items,
      page,
      size,
    };
  }

  /* Get the signatures for the given transaction id */
  getSignaturesByTransactionId(
    transactionId: number,
    withDeleted: boolean = false,
  ): Promise<TransactionSigner[]> {
    if (!transactionId) {
      return null;
    }
    return this.repo.find({
      where: {
        transaction: {
          id: transactionId,
        },
      },
      relations: {
        userKey: true,
      },
      withDeleted,
    });
  }

  /* Upload signatures for the given transaction ids */
  async uploadSignatureMaps(
    dto: UploadSignatureMapDto[],
    user: User,
  ): Promise<TransactionSigner[]> {
    const signers = new Set<TransactionSigner>();

    // Load all necessary data
    const { transactionMap, signersByTransaction } = await this.loadTransactionData(dto);

    // Validate and process signatures
    const validationResults = await this.validateAndProcessSignatures(
      dto,
      user,
      transactionMap,
      signersByTransaction
    );

    // Persist changes to database
    const transactionsToProcess = await this.persistSignatureChanges(validationResults, user, signers);

    // Update transaction statuses and emit notifications
    await this.updateStatusesAndNotify(transactionsToProcess);

    return [...signers];
  }


  private async loadTransactionData(dto: UploadSignatureMapDto[]) {
    const transactionIds = dto.map(item => item.id);

    // Batch load all transactions
    const transactions = await this.dataSource.manager.find(Transaction, {
      where: { id: In(transactionIds) },
    });

    const transactionMap = new Map(transactions.map(t => [t.id, t]));

    // Batch load all existing signers
    const existingSigners = await this.dataSource.manager.find(TransactionSigner, {
      where: { transactionId: In(transactionIds) },
      select: ['transactionId', 'userKeyId'],
    });

    // Group by transaction ID
    const signersByTransaction = new Map<number, Set<number>>();
    for (const signer of existingSigners) {
      if (!signersByTransaction.has(signer.transactionId)) {
        signersByTransaction.set(signer.transactionId, new Set());
      }
      signersByTransaction.get(signer.transactionId).add(signer.userKeyId);
    }

    return { transactionMap, signersByTransaction };
  }

  private async validateAndProcessSignatures(
    dto: UploadSignatureMapDto[],
    user: User,
    transactionMap: Map<number, Transaction>,
    signersByTransaction: Map<number, Set<number>>
  ) {
    // Build user key lookup once
    const userKeyMap = new Map<string, UserKey>();
    for (const key of user.keys) {
      userKeyMap.set(key.publicKey, key);
    }

    return Promise.all(
      dto.map(async ({ id, signatureMap: map }) => {
        try {
          const transaction = transactionMap.get(id);
          if (!transaction) return { id, error: ErrorCodes.TNF };

          // Validate transaction status
          const statusError = this.validateTransactionStatus(transaction);
          if (statusError) return { id, error: statusError };

          // Process signatures
          const { sdkTransaction, userKeys, isSameBytes } = await this.processTransactionSignatures(
            transaction,
            map,
            userKeyMap,
            signersByTransaction.get(id) || new Set()
          );

          return {
            id,
            transaction,
            sdkTransaction,
            userKeys,
            isSameBytes,
            error: null,
          };
        } catch (err) {
          console.error(`[TX ${id}] Error:`, err.message);
          return { id, error: err.message };
        }
      })
    );
  }

  private validateTransactionStatus(transaction: Transaction): string | null {
    if (
      transaction.status !== TransactionStatus.WAITING_FOR_SIGNATURES &&
      transaction.status !== TransactionStatus.WAITING_FOR_EXECUTION
    ) {
      return ErrorCodes.TNRS;
    }

    const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);
    if (isExpired(sdkTransaction)) {
      return ErrorCodes.TE;
    }

    return null;
  }

  private async processTransactionSignatures(
    transaction: Transaction,
    map: SignatureMap,
    userKeyMap: Map<string, UserKey>,
    existingSignerIds: Set<number>
  ) {
    let sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

    // Extract public keys from signature map
    const publicKeysByRaw = new Map<string, PublicKey>();
    for (const nodeMap of map.values()) {
      for (const txMap of nodeMap.values()) {
        for (const publicKey of txMap.keys()) {
          const raw = publicKey.toStringRaw();
          if (!publicKeysByRaw.has(raw)) {
            publicKeysByRaw.set(raw, publicKey);
          }
        }
      }
    }

    // Find matching user keys and add signatures
    const userKeys: UserKey[] = [];
    for (const [rawString, publicKey] of publicKeysByRaw) {
      // Fast path: check raw format first
      let userKey = userKeyMap.get(rawString);

      // Slow path: check DER format
      if (!userKey) {
        const derString = publicKey.toStringDer();
        userKey = userKeyMap.get(derString);
      }

      if (!userKey) throw new Error(ErrorCodes.PNY);

      sdkTransaction = sdkTransaction.addSignature(publicKey, map);

      if (!existingSignerIds.has(userKey.id)) {
        userKeys.push(userKey);
      }
    }

    const isSameBytes = Buffer.from(sdkTransaction.toBytes()).equals(
      transaction.transactionBytes
    );

    return { sdkTransaction, userKeys, isSameBytes };
  }

  private async persistSignatureChanges(
    validationResults: any[],
    user: User,
    signers: Set<TransactionSigner>
  ) {
    // Prepare batched operations
    const transactionsToUpdate: { id: number; transactionBytes: Buffer }[] = [];
    const notificationsToUpdate: { userId: number; transactionId: number }[] = [];
    const signersToInsert: { userId: number; transactionId: number; userKeyId: number }[] = [];
    const transactionsToProcess: { id: number; transaction: Transaction }[] = [];

    for (const result of validationResults) {
      if (result.error) {
        console.error(`[TX ${result.id}] Validation failed: ${result.error}`);
        continue;
      }

      const { id, transaction, sdkTransaction, userKeys, isSameBytes } = result;

      // Skip if nothing to do
      if (isSameBytes && userKeys.length === 0) continue;

      // Collect updates
      if (!isSameBytes) {
        transaction.transactionBytes = Buffer.from(sdkTransaction.toBytes());
        transactionsToUpdate.push({ id, transactionBytes: transaction.transactionBytes });
        notificationsToUpdate.push({ userId: user.id, transactionId: transaction.id });
      }

      // Collect inserts
      if (userKeys.length > 0) {
        const newSigners = userKeys.map(userKey => ({
          userId: user.id,
          transactionId: id,
          userKeyId: userKey.id,
        }));
        signersToInsert.push(...newSigners);
      }

      transactionsToProcess.push({ id, transaction });
    }

    // Execute in single transaction
    try {
      await this.dataSource.transaction(async manager => {
        // Bulk update transactions
        if (transactionsToUpdate.length > 0) {
          await this.bulkUpdateTransactions(manager, transactionsToUpdate);
        }

        // Bulk update notifications
        if (notificationsToUpdate.length > 0) {
          const updatedNotificationReceivers = await this.bulkUpdateNotificationReceivers(manager, notificationsToUpdate);

          emitDismissedNotifications(
            this.notificationsPublisher,
            updatedNotificationReceivers,
          );
        }

        // Bulk insert signers
        if (signersToInsert.length > 0) {
          await this.bulkInsertSigners(manager, signersToInsert, transactionsToProcess, user, signers);
        }
      });
    } catch (err) {
      console.error('Database transaction failed:', err);
      throw new BadRequestException(ErrorCodes.FST);
    }

    return transactionsToProcess;
  }

  private async bulkUpdateTransactions(
    manager: any,
    transactionsToUpdate: { id: number; transactionBytes: Buffer }[]
  ) {
    const whenClauses = transactionsToUpdate
      .map((t, index) => `WHEN ${t.id} THEN $${index + 1}::bytea`)
      .join(' ');

    const ids = transactionsToUpdate.map(t => t.id);
    const bytes = transactionsToUpdate.map(t => t.transactionBytes);

    await manager.query(
      `UPDATE transaction
     SET "transactionBytes" = CASE id ${whenClauses} END,
         "updatedAt" = NOW()
     WHERE id = ANY($${bytes.length + 1})`,
      [...bytes, ids]
    );
  }

  private async bulkUpdateNotificationReceivers(
    manager: any,
    notificationsToUpdate: { userId: number; transactionId: number }[]
  ) {
    if (!notificationsToUpdate.length) return [];

    // Separate arrays of userIds and transactionIds
    const userIds = notificationsToUpdate.map(n => n.userId);
    const txIds = notificationsToUpdate.map(n => n.transactionId);

    // Use UNNEST to preserve 1:1 pairing between userIds and transactionIds
    return await manager.query(
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
      [userIds, txIds]
    );
  }

  private async bulkInsertSigners(
    manager: any,
    signersToInsert: any[],
    transactionsToProcess: any[],
    user: User,
    signers: Set<TransactionSigner>
  ) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(TransactionSigner)
      .values(signersToInsert)
      .execute();

    if (signers) {
      const insertedSigners = await manager.find(TransactionSigner, {
        where: {
          transactionId: In(transactionsToProcess.map(t => t.id)),
          userId: user.id,
        },
      });
      insertedSigners.forEach(signer => signers.add(signer));
    }
  }

  private async updateStatusesAndNotify(
    transactionsToProcess: Array<{ id: number; transaction: Transaction }>
  ) {
    if (transactionsToProcess.length === 0) return;

    // Process statuses in bulk
    let statusMap: Map<number, TransactionStatus>;
    try {
      statusMap = await processTransactionStatus(
        this.txRepo,
        this.transactionSignatureService,
        transactionsToProcess.map(t => t.transaction)
      );
    } catch (err) {
      console.error('Bulk status processing failed:', err);
      statusMap = new Map();
    }

    // Separate new statuses from unchanged
    const newStatusResults: number[] = [];
    const unchangedResults: number[] = [];

    for (const { id } of transactionsToProcess) {
      if (statusMap.has(id)) {
        newStatusResults.push(id);
      } else {
        unchangedResults.push(id);
      }
    }

    // Emit notifications
    if (newStatusResults.length > 0) {
      emitTransactionStatusUpdate(
        this.notificationsPublisher,
        newStatusResults.map(id => ({ entityId: id }))
      );
    }
    if (unchangedResults.length > 0) {
      emitTransactionUpdate(
        this.notificationsPublisher,
        unchangedResults.map(id => ({ entityId: id }))
      );
    }
  }
}