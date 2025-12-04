import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, In, Repository } from 'typeorm';
import { PublicKey, Transaction as SDKTransaction } from '@hashgraph/sdk';

import {
  isExpired,
  PaginatedResourceDto,
  Pagination,
  ErrorCodes,
  MirrorNodeService,
  NatsPublisherService,
  emitTransactionStatusUpdate, emitTransactionUpdate, processTransactionStatusBulk,
} from '@app/common';
import {
  Transaction,
  TransactionSigner,
  TransactionStatus,
  User,
  UserKey,
} from '@entities';

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
    private readonly mirrorNodeService: MirrorNodeService,
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

    /////////////////////
    const processingStartTime = performance.now();

// ✅ STEP 1: Extract all transaction IDs
    const transactionIds = dto.map(item => item.id);

// ✅ STEP 2: Batch load ALL transactions in one query
    const loadStartTime = performance.now();
    const transactions = await this.dataSource.manager.find(Transaction, {
      where: {
        id: In(transactionIds)
      },
    });

// Create a Map for O(1) lookup
    const transactionMap = new Map(transactions.map(t => [t.id, t]));

// ✅ STEP 3: Batch load ALL existing signers in one query
    const existingSigners = await this.dataSource.manager.find(TransactionSigner, {
      where: {
        transactionId: In(transactionIds)
      },
      select: ['transactionId', 'userKeyId']
    });

// Group by transaction ID for O(1) lookup
    const signersByTransaction = new Map<number, Set<number>>();
    for (const signer of existingSigners) {
      if (!signersByTransaction.has(signer.transactionId)) {
        signersByTransaction.set(signer.transactionId, new Set());
      }
      signersByTransaction.get(signer.transactionId).add(signer.userKeyId);
    }

    console.log(`Batch load (2 queries for ${transactionIds.length} transactions): ${(performance.now() - loadStartTime).toFixed(2)}ms`);

// ✅ STEP 4: Process all transactions (no more DB queries!)
    const validationStartTime = performance.now();

// ✅ Build user key lookup ONCE - Map<string, UserKey>
    const userKeyMap = new Map<string, UserKey>();
    for (const key of user.keys) {
      userKeyMap.set(key.publicKey, key);
    }

    const validationResults = await Promise.all(
      dto.map(async ({ id, signatureMap: map }) => {
        try {
          // In-memory lookup
          const transaction = transactionMap.get(id);
          if (!transaction) return { id, error: ErrorCodes.TNF };

          if (
            transaction.status !== TransactionStatus.WAITING_FOR_SIGNATURES &&
            transaction.status !== TransactionStatus.WAITING_FOR_EXECUTION
          )
            return { id, error: ErrorCodes.TNRS };

          let sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);
          if (isExpired(sdkTransaction)) return { id, error: ErrorCodes.TE };

          // Build Map<string, PublicKey> with raw format as keys
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

          // In-memory lookup
          const existingSignerIds = signersByTransaction.get(id) || new Set();
          const userKeys: UserKey[] = [];

          for (const [rawString, publicKey] of publicKeysByRaw) {
            // Fast path: check raw format first (most common)
            let userKey = userKeyMap.get(rawString);

            // Slow path: check DER format only if needed
            if (!userKey) {
              const derString = publicKey.toStringDer();
              userKey = userKeyMap.get(derString);
            }

            if (!userKey) return { id, error: ErrorCodes.PNY };

            sdkTransaction = sdkTransaction.addSignature(publicKey, map);

            if (!existingSignerIds.has(userKey.id)) {
              userKeys.push(userKey);
            }
          }

          const isSameBytes = Buffer.from(sdkTransaction.toBytes()).equals(transaction.transactionBytes);

          return {
            id,
            transaction,
            sdkTransaction,
            userKeys,
            isSameBytes,
            error: null
          };
        } catch (err) {
          console.error(`[TX ${id}] Error:`, err.message);
          return { id, error: err.message };
        }
      })
    );

    console.log(`Phase 1 (parallel validation): ${(performance.now() - validationStartTime).toFixed(2)}ms`);
    console.log(`Total processing time: ${(performance.now() - processingStartTime).toFixed(2)}ms`);

// ✅✅✅ PHASE 2: OPTIMIZED BATCHED WRITES ✅✅✅
    const dbPhaseStartTime = performance.now();

// Prepare all updates and inserts
    const transactionsToUpdate: { id: number; transactionBytes: Buffer }[] = [];
    const signersToInsert: { userId: number; transactionId: number; userKeyId: number }[] = [];
    const transactionsToProcess: { id: number; transaction: Transaction }[] = [];

    for (const result of validationResults) {
      if (result.error) {
        console.error(`[TX ${result.id}] Validation failed: ${result.error}`);
        continue;
      }

      const { id, transaction, sdkTransaction, userKeys, isSameBytes } = result;

      // Skip if nothing to do
      if (isSameBytes && userKeys.length === 0) {
        continue;
      }

      // Collect updates (just the data, not full entities)
      if (!isSameBytes) {
        transaction.transactionBytes = Buffer.from(sdkTransaction.toBytes());
        transactionsToUpdate.push({
          id,
          transactionBytes: transaction.transactionBytes,
        });
      }

      // Collect inserts
      if (userKeys.length > 0) {
        const newSigners = userKeys.map(userKey => ({
          userId: user.id,
          transactionId: id,
          userKeyId: userKey.id
        }));
        signersToInsert.push(...newSigners);
      }

      // Track transactions that need status processing
      transactionsToProcess.push({ id, transaction });
    }

    console.log(`[BATCH] Prepared ${transactionsToUpdate.length} updates, ${signersToInsert.length} inserts`);

// ✅ SINGLE DATABASE TRANSACTION with TRUE bulk operations
    const batchDbStartTime = performance.now();
    try {
      await this.dataSource.transaction(async (manager) => {

        // ✅ BULK UPDATE - Single query with CASE statement (FIXED)
        if (transactionsToUpdate.length > 0) {
          console.log(`[BATCH] Bulk updating ${transactionsToUpdate.length} transactions...`);

          // Build CASE statement for bulk update with proper bytea casting
          const whenClauses = transactionsToUpdate
            .map((t, index) => `WHEN ${t.id} THEN $${index + 1}::bytea`)  // 👈 Add ::bytea cast
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

        // ✅ BULK INSERT - Single INSERT with multiple VALUES
        if (signersToInsert.length > 0) {
          console.log(`[BATCH] Bulk inserting ${signersToInsert.length} signers...`);

          await manager
            .createQueryBuilder()
            .insert()
            .into(TransactionSigner)
            .values(signersToInsert)
            .execute();

          // If you need the inserted entities with IDs, do a single SELECT after:
          if (signers) { // If signers Set is needed
            const insertedSigners = await manager.find(TransactionSigner, {
              where: {
                transactionId: In(transactionsToProcess.map(t => t.id)),
                userId: user.id
              }
            });
            insertedSigners.forEach(signer => signers.add(signer));
          }
        }
      });

      console.log(`[BATCH] Database transaction: ${(performance.now() - batchDbStartTime).toFixed(2)}ms`);
    } catch (err) {
      console.error(`[BATCH] Database transaction failed:`, err);
      throw new BadRequestException(ErrorCodes.FST);
    }

// ✅ PARALLEL STATUS PROCESSING
    const statusStartTime = performance.now();
    console.log(`[BATCH] Processing status for ${transactionsToProcess.length} transactions (bulk)...`);

    let statusMap: Map<number, TransactionStatus>;
    try {
      // processTransactionStatus should accept the list and return Map<id, Transaction>
      statusMap = await processTransactionStatusBulk(
        this.txRepo,
        this.mirrorNodeService,
        transactionsToProcess.map(t => t.transaction)
      );
    } catch (err) {
      console.error('[BATCH] Bulk status processing failed:', err);
      statusMap = new Map();
    }

    const statusResults = transactionsToProcess.map(({ id }) => {
      const txElapsed = (performance.now() - statusStartTime).toFixed(2);
      console.log(`[TX ${id}] Bulk status check elapsed: ${txElapsed}ms`);
      return { id, success: statusMap.has(id) };
    });

// Collect successful IDs
    const { newStatusResults, unchangedResults } = statusResults.reduce(
      (acc, { id, success }) => {
        (success ? acc.newStatusResults : acc.unchangedResults).push(id);
        return acc;
      },
      { newStatusResults: [] as number[], unchangedResults: [] as number[] }
    );

    console.log(`[BATCH] Status processing (bulk): ${(performance.now() - statusStartTime).toFixed(2)}ms`);
    //
    //
    //
    //
    // const statusResults = await Promise.all(
    //   transactionsToProcess.map(async ({ id, transaction }) => {
    //     const txStatusStart = performance.now();
    //     try {
    //       const newStatus = await processTransactionStatus(
    //         this.txRepo,
    //         this.mirrorNodeService,
    //         transaction
    //       );
    //
    //       const elapsed = (performance.now() - txStatusStart).toFixed(2);
    //       console.log(`[TX ${id}] Process status: ${elapsed}ms`);
    //
    //       return { id, success: !!newStatus };
    //     } catch (err) {
    //       console.error(`[TX ${id}] Status processing failed:`, err);
    //       return { id, success: false };
    //     }
    //   })
    // );
    //
    // // Collect successful IDs
    // const { newStatusResults, unchangedResults } = statusResults.reduce(
    //   (acc, { id, success }) => {
    //     (success ? acc.newStatusResults : acc.unchangedResults).push(id);
    //     return acc;
    //   },
    //   { newStatusResults: [] as number[], unchangedResults: [] as number[] }
    // );

    // console.log(`[BATCH] Status processing (parallel): ${(performance.now() - statusStartTime).toFixed(2)}ms`);
    console.log(`Phase 2 (optimized batch writes): ${(performance.now() - dbPhaseStartTime).toFixed(2)}ms`);
    console.log(`Total processing with optimizations: ${(performance.now() - processingStartTime).toFixed(2)}ms`);

    if (newStatusResults.length > 0) {
      emitTransactionStatusUpdate(this.notificationsPublisher, newStatusResults.map(id => ({ entityId: id })));
    }
    if (unchangedResults.length > 0) {
      emitTransactionUpdate(this.notificationsPublisher, unchangedResults.map(id => ({ entityId: id })));
    }

    return [...signers];
  }
}
