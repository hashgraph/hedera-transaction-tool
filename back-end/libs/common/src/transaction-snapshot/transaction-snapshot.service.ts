import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';

import {
  AccountSnapshot,
  NodeSnapshot,
  TransactionAccountSnapshot,
  TransactionCachedAccount,
  TransactionCachedNode,
  TransactionNodeSnapshot,
} from '@entities';

import { deserializeKey, flattenKeyList } from '../utils/sdk/key';

@Injectable()
export class TransactionSnapshotService {
  private readonly logger = new Logger(TransactionSnapshotService.name);

  constructor(
    @InjectRepository(AccountSnapshot)
    private readonly accountSnapshotRepo: Repository<AccountSnapshot>,
    @InjectRepository(NodeSnapshot)
    private readonly nodeSnapshotRepo: Repository<NodeSnapshot>,
    @InjectRepository(TransactionCachedAccount)
    private readonly transactionCachedAccountRepo: Repository<TransactionCachedAccount>,
    @InjectRepository(TransactionCachedNode)
    private readonly transactionCachedNodeRepo: Repository<TransactionCachedNode>,
    @InjectRepository(TransactionAccountSnapshot)
    private readonly transactionAccountSnapshotRepo: Repository<TransactionAccountSnapshot>,
    @InjectRepository(TransactionNodeSnapshot)
    private readonly transactionNodeSnapshotRepo: Repository<TransactionNodeSnapshot>,
  ) {}

  // Called at every terminal state transition (EXECUTED, FAILED, EXPIRED,
  // CANCELED, ARCHIVED). Writes account and node snapshots so that signer-
  // reporting queries can reconstruct the exact key structure that was active
  // when each transaction ran, without hitting the mirror node at query time.
  async captureForTransaction(transactionId: number, executedAt: Date): Promise<void> {
    const results = await Promise.allSettled([
      this.captureAccountSnapshots(transactionId, executedAt),
      this.captureNodeSnapshots(transactionId, executedAt),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        const err = result.reason;
        this.logger.error(
          `Failed to capture snapshots for transaction ${transactionId}: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }
  }

  private async captureAccountSnapshots(transactionId: number, executedAt: Date): Promise<void> {
    const links = await this.transactionCachedAccountRepo.find({
      where: { transactionId },
      relations: { cachedAccount: true },
    });

    for (const link of links) {
      const ca = link.cachedAccount;
      if (!ca?.encodedKey) {
        this.logger.warn(
          `Skipping account snapshot for transaction ${transactionId}: ` +
          `${!ca ? 'cachedAccount missing' : `encodedKey null on ${ca.account}/${ca.mirrorNetwork}`}`,
        );
        continue;
      }

      const snapshot = await this.resolveAccountSnapshot(
        ca.account,
        ca.mirrorNetwork,
        ca.encodedKey,
        ca.receiverSignatureRequired ?? false,
        executedAt,
      );

      await this.transactionAccountSnapshotRepo
        .createQueryBuilder()
        .insert()
        .into(TransactionAccountSnapshot)
        .values({
          transaction: { id: transactionId },
          accountSnapshot: { id: snapshot.id },
          isReceiver: link.isReceiver,
        })
        .orIgnore()
        .execute();
    }
  }

  private async captureNodeSnapshots(transactionId: number, executedAt: Date): Promise<void> {
    const links = await this.transactionCachedNodeRepo.find({
      where: { transactionId },
      relations: { cachedNode: true },
    });

    for (const link of links) {
      const cn = link.cachedNode;
      if (!cn?.encodedKey) {
        this.logger.warn(
          `Skipping node snapshot for transaction ${transactionId}: ` +
          `${!cn ? 'cachedNode missing' : `encodedKey null on nodeId ${cn.nodeId}/${cn.mirrorNetwork}`}`,
        );
        continue;
      }

      const snapshot = await this.resolveNodeSnapshot(
        cn.nodeId,
        cn.mirrorNetwork,
        cn.encodedKey,
        executedAt,
      );

      await this.transactionNodeSnapshotRepo
        .createQueryBuilder()
        .insert()
        .into(TransactionNodeSnapshot)
        .values({
          transaction: { id: transactionId },
          nodeSnapshot: { id: snapshot.id },
        })
        .orIgnore()
        .execute();
    }
  }

  // Changelog model: compare the latest snapshot for this account against the
  // current key. If unchanged, reuse the existing row. If changed, insert a new
  // row stamped with executedAt so the timeline stays accurate.
  private async resolveAccountSnapshot(
    account: string,
    mirrorNetwork: string,
    encodedKey: Buffer,
    receiverSignatureRequired: boolean,
    executedAt: Date,
  ): Promise<AccountSnapshot> {
    const keyHash = createHash('sha256').update(encodedKey).digest('hex');

    const latest = await this.accountSnapshotRepo.findOne({
      where: { account, mirrorNetwork },
      order: { createdAt: 'DESC' },
      select: { id: true, keyHash: true, receiverSignatureRequired: true },
    });

    if (latest?.keyHash === keyHash && latest.receiverSignatureRequired === receiverSignatureRequired) {
      return latest;
    }

    const publicKeys = this.extractPublicKeys(encodedKey);
    return this.accountSnapshotRepo.save({
      account, mirrorNetwork, encodedKey, keyHash, publicKeys, receiverSignatureRequired,
      createdAt: executedAt,
    });
  }

  // Same changelog model as resolveAccountSnapshot.
  private async resolveNodeSnapshot(
    nodeId: number,
    mirrorNetwork: string,
    encodedKey: Buffer,
    executedAt: Date,
  ): Promise<NodeSnapshot> {
    const keyHash = createHash('sha256').update(encodedKey).digest('hex');

    const latest = await this.nodeSnapshotRepo.findOne({
      where: { nodeId, mirrorNetwork },
      order: { createdAt: 'DESC' },
      select: { id: true, keyHash: true },
    });

    if (latest?.keyHash === keyHash) {
      return latest;
    }

    const publicKeys = this.extractPublicKeys(encodedKey);
    return this.nodeSnapshotRepo.save({
      nodeId, mirrorNetwork, encodedKey, keyHash, publicKeys,
      createdAt: executedAt,
    });
  }

  private extractPublicKeys(encodedKey: Buffer): string[] {
    try {
      const key = deserializeKey(encodedKey);
      return [...new Set(flattenKeyList(key).map(k => k.toStringRaw()))].sort();
    } catch {
      return [];
    }
  }
}
