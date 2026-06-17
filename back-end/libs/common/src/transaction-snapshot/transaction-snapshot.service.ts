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
    @InjectRepository(TransactionAccountSnapshot)
    private readonly transactionAccountSnapshotRepo: Repository<TransactionAccountSnapshot>,
    @InjectRepository(TransactionNodeSnapshot)
    private readonly transactionNodeSnapshotRepo: Repository<TransactionNodeSnapshot>,
    @InjectRepository(TransactionCachedAccount)
    private readonly transactionCachedAccountRepo: Repository<TransactionCachedAccount>,
    @InjectRepository(TransactionCachedNode)
    private readonly transactionCachedNodeRepo: Repository<TransactionCachedNode>,
  ) {}

  async captureForTransaction(transactionId: number): Promise<void> {
    try {
      await Promise.all([
        this.captureAccountSnapshots(transactionId),
        this.captureNodeSnapshots(transactionId),
      ]);
    } catch (err) {
      this.logger.error(
        `Failed to capture snapshots for transaction ${transactionId}: ${err.message}`,
        err.stack,
      );
    }
  }

  private async captureAccountSnapshots(transactionId: number): Promise<void> {
    const links = await this.transactionCachedAccountRepo.find({
      where: { transactionId },
      relations: { cachedAccount: true },
    });

    for (const link of links) {
      const { account, mirrorNetwork, encodedKey, receiverSignatureRequired } = link.cachedAccount;
      if (!encodedKey) continue;

      const snapshotId = await this.resolveAccountSnapshot(
        account,
        mirrorNetwork,
        encodedKey,
        receiverSignatureRequired ?? false,
      );
      await this.transactionAccountSnapshotRepo
        .createQueryBuilder()
        .insert()
        .into(TransactionAccountSnapshot)
        .values({ transactionId, keySnapshotId: snapshotId, isReceiver: link.isReceiver })
        .orIgnore()
        .execute();
    }
  }

  private async captureNodeSnapshots(transactionId: number): Promise<void> {
    const links = await this.transactionCachedNodeRepo.find({
      where: { transactionId },
      relations: { cachedNode: true },
    });

    for (const link of links) {
      const { nodeId, mirrorNetwork, encodedKey } = link.cachedNode;
      if (!encodedKey) continue;

      const snapshotId = await this.resolveNodeSnapshot(nodeId, mirrorNetwork, encodedKey);
      await this.transactionNodeSnapshotRepo
        .createQueryBuilder()
        .insert()
        .into(TransactionNodeSnapshot)
        .values({ transactionId, keySnapshotId: snapshotId })
        .orIgnore()
        .execute();
    }
  }

  // Returns the ID of the latest snapshot for this account if its key and
  // receiverSignatureRequired are unchanged, otherwise inserts a new row.
  // Concurrent captures for the same account may rarely produce an adjacent
  // duplicate row — this is benign since TransactionAccountSnapshot still
  // binds each transaction to its own row.
  private async resolveAccountSnapshot(
    account: string,
    mirrorNetwork: string,
    encodedKey: Buffer,
    receiverSignatureRequired: boolean,
  ): Promise<number> {
    const keyHash = createHash('sha256').update(encodedKey).digest('hex');

    const latest = await this.accountSnapshotRepo.findOne({
      where: { account, mirrorNetwork },
      order: { createdAt: 'DESC' },
      select: { id: true, keyHash: true, receiverSignatureRequired: true },
    });

    if (latest?.keyHash === keyHash && latest?.receiverSignatureRequired === receiverSignatureRequired) {
      return latest.id;
    }

    const publicKeys = this.extractPublicKeys(encodedKey);
    const saved = await this.accountSnapshotRepo.save({
      account, mirrorNetwork, encodedKey, keyHash, publicKeys, receiverSignatureRequired,
    });
    return saved.id;
  }

  // Same model as resolveAccountSnapshot — reuses the latest node snapshot if
  // the key is unchanged, otherwise appends a new row.
  private async resolveNodeSnapshot(
    nodeId: number,
    mirrorNetwork: string,
    encodedKey: Buffer,
  ): Promise<number> {
    const keyHash = createHash('sha256').update(encodedKey).digest('hex');

    const latest = await this.nodeSnapshotRepo.findOne({
      where: { nodeId, mirrorNetwork },
      order: { createdAt: 'DESC' },
      select: { id: true, keyHash: true },
    });

    if (latest?.keyHash === keyHash) {
      return latest.id;
    }

    const publicKeys = this.extractPublicKeys(encodedKey);
    const saved = await this.nodeSnapshotRepo.save({
      nodeId, mirrorNetwork, encodedKey, keyHash, publicKeys,
    });
    return saved.id;
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
