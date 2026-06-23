import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';

import {
  AccountSnapshot,
  NodeSnapshot,
  TransactionCachedAccount,
  TransactionCachedNode,
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
      const { account, mirrorNetwork, encodedKey, receiverSignatureRequired } = link.cachedAccount;
      if (!encodedKey) continue;

      await this.resolveAccountSnapshot(
        account,
        mirrorNetwork,
        encodedKey,
        receiverSignatureRequired ?? false,
        executedAt,
      );
    }
  }

  private async captureNodeSnapshots(transactionId: number, executedAt: Date): Promise<void> {
    const links = await this.transactionCachedNodeRepo.find({
      where: { transactionId },
      relations: { cachedNode: true },
    });

    for (const link of links) {
      const { nodeId, mirrorNetwork, encodedKey } = link.cachedNode;
      if (!encodedKey) continue;

      await this.resolveNodeSnapshot(nodeId, mirrorNetwork, encodedKey, executedAt);
    }
  }

  // Changelog model: compare the latest snapshot for this account against the
  // current key. If unchanged, do nothing (reuse the existing row). If changed,
  // insert a new row stamped with executedAt so the timeline stays accurate.
  // A→B→A produces three rows with distinct createdAt values, which lets the
  // standard lookup query (WHERE createdAt <= executedAt ORDER BY createdAt DESC)
  // return the correct snapshot for any transaction in history.
  private async resolveAccountSnapshot(
    account: string,
    mirrorNetwork: string,
    encodedKey: Buffer,
    receiverSignatureRequired: boolean,
    executedAt: Date,
  ): Promise<void> {
    const keyHash = createHash('sha256').update(encodedKey).digest('hex');

    const latest = await this.accountSnapshotRepo.findOne({
      where: { account, mirrorNetwork },
      order: { createdAt: 'DESC' },
      select: { id: true, keyHash: true, receiverSignatureRequired: true },
    });

    if (latest?.keyHash === keyHash && latest.receiverSignatureRequired === receiverSignatureRequired) {
      return;
    }

    const publicKeys = this.extractPublicKeys(encodedKey);
    await this.accountSnapshotRepo.save({
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
  ): Promise<void> {
    const keyHash = createHash('sha256').update(encodedKey).digest('hex');

    const latest = await this.nodeSnapshotRepo.findOne({
      where: { nodeId, mirrorNetwork },
      order: { createdAt: 'DESC' },
      select: { id: true, keyHash: true },
    });

    if (latest?.keyHash === keyHash) {
      return;
    }

    const publicKeys = this.extractPublicKeys(encodedKey);
    await this.nodeSnapshotRepo.save({
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
