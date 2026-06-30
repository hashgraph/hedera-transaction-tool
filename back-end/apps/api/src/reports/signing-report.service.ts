import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

import {
  Transaction,
  TransactionAccountSnapshot,
  TransactionCachedAccount,
  TransactionCachedNode,
  TransactionGroup,
  TransactionGroupItem,
  TransactionNodeSnapshot,
  TransactionSigner,
  UserKey,
} from '@entities';

import {
  SigningEntityType,
  SigningReportItemDto,
  SigningReportQueryDto,
  SigningReportType,
  SigningStatus,
} from './dto/signing-report.dto';

// A flattened key source for a single transaction: either an account or a node,
// along with the public keys that were active on it when the transaction ran.
interface KeySource {
  entityType: SigningEntityType;
  entityId: string;
  publicKeys: string[];
}

interface ReportOptions {
  accountFilter?: string;
  userFilter?: number;
  includeUnexecuted: boolean;
}

// Snapshot key-overlap predicate, reused for the account and node snapshot
// selection queries (the joined snapshot is always aliased `snap`).
const SNAPSHOT_KEY_OVERLAP = 'snap."publicKeys" && ARRAY[:...publicKeys]::text[]';

// A resolved, empty transaction-id selection — used to skip the pending-cache
// queries when the report is limited to completed transactions.
const noTransactionIds = (): Promise<number[]> => Promise.resolve([]);

// Deterministic report order: chronological by transaction, then by the
// account/node within it, then by public key. Applied to the flat row list so
// the output ordering is a stable contract regardless of DB/relation order.
const byReportOrder = (a: SigningReportItemDto, b: SigningReportItemDto): number =>
  a.validStart.localeCompare(b.validStart) ||
  a.transactionId - b.transactionId ||
  a.entityType.localeCompare(b.entityType) ||
  a.entityId.localeCompare(b.entityId, undefined, { numeric: true }) ||
  a.publicKey.localeCompare(b.publicKey);

@Injectable()
export class SigningReportService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(TransactionAccountSnapshot)
    private readonly txAccountSnapshotRepo: Repository<TransactionAccountSnapshot>,
    @InjectRepository(TransactionNodeSnapshot)
    private readonly txNodeSnapshotRepo: Repository<TransactionNodeSnapshot>,
    @InjectRepository(TransactionCachedAccount)
    private readonly txCachedAccountRepo: Repository<TransactionCachedAccount>,
    @InjectRepository(TransactionCachedNode)
    private readonly txCachedNodeRepo: Repository<TransactionCachedNode>,
    @InjectRepository(TransactionGroup)
    private readonly transactionGroupRepo: Repository<TransactionGroup>,
    @InjectRepository(TransactionGroupItem)
    private readonly transactionGroupItemRepo: Repository<TransactionGroupItem>,
    @InjectRepository(TransactionSigner)
    private readonly transactionSignerRepo: Repository<TransactionSigner>,
    @InjectRepository(UserKey)
    private readonly userKeyRepo: Repository<UserKey>,
  ) {}

  async getSigningReport(query: SigningReportQueryDto): Promise<SigningReportItemDto[]> {
    // completedOnly defaults to true; when false we also report not-yet-complete
    // transactions, reading their keys from the live account/node cache.
    const includeUnexecuted = !(query.completedOnly ?? true);

    switch (query.type) {
      case SigningReportType.TRANSACTION:
        return this.reportForTransaction(this.parseNumericId(query.id), includeUnexecuted);
      case SigningReportType.GROUP:
        return this.reportForGroup(this.parseNumericId(query.id), includeUnexecuted);
      case SigningReportType.ACCOUNT:
        return this.reportForAccount(
          query.id,
          query.mirrorNetwork,
          query.startDate,
          query.endDate,
          includeUnexecuted,
        );
      case SigningReportType.USER:
        return this.reportForUser(
          this.parseNumericId(query.id),
          query.mirrorNetwork,
          query.startDate,
          query.endDate,
          includeUnexecuted,
        );
      default: {
        // Exhaustive: if a new SigningReportType is added without a case here,
        // this assignment fails to compile. At runtime it guards against an
        // unexpected type slipping past validation.
        const unhandled: never = query.type;
        throw new BadRequestException(`Unsupported report type: ${unhandled}`);
      }
    }
  }

  // transaction and group are looked up by globally-unique database id, which
  // already pins the network — so no mirrorNetwork scope is needed or accepted.
  private async reportForTransaction(
    id: number,
    includeUnexecuted: boolean,
  ): Promise<SigningReportItemDto[]> {
    const transaction = await this.loadTransactions([id], includeUnexecuted);
    if (transaction.length === 0) throw new NotFoundException(`Transaction ${id} not found`);
    return this.buildReport(transaction, { includeUnexecuted });
  }

  private async reportForGroup(
    groupId: number,
    includeUnexecuted: boolean,
  ): Promise<SigningReportItemDto[]> {
    const group = await this.transactionGroupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException(`Group ${groupId} not found`);

    const items = await this.transactionGroupItemRepo.find({ where: { groupId } });
    const txIds = items.map(item => item.transactionId);

    return this.buildReport(await this.loadTransactions(txIds, includeUnexecuted), {
      includeUnexecuted,
    });
  }

  private async reportForAccount(
    accountId: string,
    mirrorNetwork: string | undefined,
    startDate: Date | undefined,
    endDate: Date | undefined,
    includeUnexecuted: boolean,
  ): Promise<SigningReportItemDto[]> {
    mirrorNetwork = this.requireMirrorNetwork(mirrorNetwork);
    const range = this.parseDateRange(startDate, endDate);

    // Executed transactions read their historical key from the account snapshot;
    // not-yet-executed ones (only when requested) read the live account cache.
    // The two selections are independent, so run them in parallel.
    const [executedIds, pendingIds] = await Promise.all([
      this.selectTransactionIds(
        this.txAccountSnapshotRepo
          .createQueryBuilder('tas')
          .innerJoin('tas.accountSnapshot', 'snap', 'snap.account = :accountId', { accountId }),
        true,
        range,
        mirrorNetwork,
      ),
      includeUnexecuted
        ? this.selectTransactionIds(
            this.txCachedAccountRepo
              .createQueryBuilder('tca')
              .innerJoin('tca.cachedAccount', 'ca', 'ca.account = :accountId', { accountId }),
            false,
            range,
            mirrorNetwork,
          )
        : noTransactionIds(),
    ]);

    const txIds = new Set([...executedIds, ...pendingIds]);

    const transactions = await this.loadTransactions([...txIds], includeUnexecuted, mirrorNetwork);
    return this.buildReport(transactions, { accountFilter: accountId, includeUnexecuted });
  }

  private async reportForUser(
    userId: number,
    mirrorNetwork: string | undefined,
    startDate: Date | undefined,
    endDate: Date | undefined,
    includeUnexecuted: boolean,
  ): Promise<SigningReportItemDto[]> {
    mirrorNetwork = this.requireMirrorNetwork(mirrorNetwork);
    const range = this.parseDateRange(startDate, endDate);

    const userKeys = await this.userKeyRepo.find({ where: { userId }, withDeleted: true });
    if (userKeys.length === 0) return [];

    const publicKeys = userKeys.map(key => key.publicKey);

    // Executed transactions match the user's keys against account/node snapshots;
    // not-yet-executed ones (only when requested) match the live account/node
    // caches. All selections are independent, so run them in parallel.
    const idLists = await Promise.all([
      this.selectTransactionIds(
        this.txAccountSnapshotRepo
          .createQueryBuilder('tas')
          .innerJoin('tas.accountSnapshot', 'snap', SNAPSHOT_KEY_OVERLAP, { publicKeys }),
        true,
        range,
        mirrorNetwork,
      ),
      this.selectTransactionIds(
        this.txNodeSnapshotRepo
          .createQueryBuilder('tns')
          .innerJoin('tns.nodeSnapshot', 'snap', SNAPSHOT_KEY_OVERLAP, { publicKeys }),
        true,
        range,
        mirrorNetwork,
      ),
      includeUnexecuted
        ? this.selectTransactionIds(
            this.txCachedAccountRepo
              .createQueryBuilder('tca')
              .innerJoin('tca.cachedAccount', 'ca')
              .innerJoin('ca.keys', 'cak', 'cak.publicKey IN (:...publicKeys)', { publicKeys }),
            false,
            range,
            mirrorNetwork,
          )
        : noTransactionIds(),
      includeUnexecuted
        ? this.selectTransactionIds(
            this.txCachedNodeRepo
              .createQueryBuilder('tcn')
              .innerJoin('tcn.cachedNode', 'cn')
              .innerJoin('cn.keys', 'cnk', 'cnk.publicKey IN (:...publicKeys)', { publicKeys }),
            false,
            range,
            mirrorNetwork,
          )
        : noTransactionIds(),
    ]);

    const txIds = new Set(idLists.flat());

    const transactions = await this.loadTransactions([...txIds], includeUnexecuted, mirrorNetwork);
    return this.buildReport(transactions, { userFilter: userId, includeUnexecuted });
  }

  /**
   * Runs a transaction-id selection query. The caller supplies a query builder
   * on a junction table with the entity-specific key join already applied; this
   * adds the shared transaction join (date range + executed/pending filter),
   * the DISTINCT select, and returns the matching transaction ids.
   */
  private async selectTransactionIds(
    keyFilteredQuery: SelectQueryBuilder<ObjectLiteral>,
    executed: boolean,
    range: { start: Date; end: Date },
    mirrorNetwork: string,
  ): Promise<number[]> {
    const junctionAlias = keyFilteredQuery.alias;
    const rows = await keyFilteredQuery
      .innerJoin(
        `${junctionAlias}.transaction`,
        'tx',
        `tx.mirrorNetwork = :mirrorNetwork AND tx.validStart >= :start AND tx.validStart < :end AND tx.executedAt IS ${executed ? 'NOT NULL' : 'NULL'}`,
        { ...range, mirrorNetwork },
      )
      .select(`DISTINCT ${junctionAlias}.transactionId`, 'transactionId')
      .getRawMany<{ transactionId: number | string }>();

    // getRawMany may return numeric columns as strings depending on the driver;
    // normalize to numbers and drop anything non-numeric defensively.
    return rows.map(row => Number(row.transactionId)).filter(id => Number.isInteger(id));
  }

  /**
   * Loads transactions with the key data needed to build the report. When a
   * mirrorNetwork is given (the account/user reports) the load is scoped to it,
   * since account IDs are network-relative; the transaction/group reports omit
   * it because their database id already pins the network. Executed transactions
   * carry account/node snapshots (the historical key); when unexecuted
   * transactions are requested, the live account/node cache relations are loaded
   * too so their pending keys can be resolved.
   */
  private loadTransactions(
    ids: number[],
    includeUnexecuted: boolean,
    mirrorNetwork?: string,
  ): Promise<Transaction[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.transactionRepo.find({
      where: mirrorNetwork ? { id: In(ids), mirrorNetwork } : { id: In(ids) },
      // Only the columns the report emits — avoids loading the large transaction
      // byte blobs and other unused columns.
      select: { id: true, createdAt: true, validStart: true, executedAt: true },
      // Load each to-many relation in its own query rather than via LEFT JOINs,
      // which would otherwise produce a cartesian product across the account and
      // node relations.
      relationLoadStrategy: 'query',
      relations: {
        transactionAccountSnapshots: { accountSnapshot: true },
        transactionNodeSnapshots: { nodeSnapshot: true },
        ...(includeUnexecuted
          ? {
              transactionCachedAccounts: { cachedAccount: { keys: true } },
              transactionCachedNodes: { cachedNode: { keys: true } },
            }
          : {}),
      },
    });
  }

  private async buildReport(
    transactions: Transaction[],
    options: ReportOptions,
  ): Promise<SigningReportItemDto[]> {
    if (transactions.length === 0) return [];

    const txIds = transactions.map(tx => tx.id);

    // transactionId -> set of userKeyIds that signed the transaction
    const signers = await this.transactionSignerRepo.find({
      where: { transactionId: In(txIds) },
      select: { transactionId: true, userKeyId: true },
    });
    const signersByTx = new Map<number, Set<number>>();
    for (const signer of signers) {
      let set = signersByTx.get(signer.transactionId);
      if (!set) signersByTx.set(signer.transactionId, (set = new Set()));
      set.add(signer.userKeyId);
    }

    // transactionId -> the account/node key sources to report
    const sourcesByTx = new Map<number, KeySource[]>();
    const allPublicKeys = new Set<string>();
    for (const tx of transactions) {
      const sources = this.collectKeySources(tx, options);
      sourcesByTx.set(tx.id, sources);
      for (const source of sources) {
        for (const publicKey of source.publicKeys) allPublicKeys.add(publicKey);
      }
    }

    const keyToOwner = await this.resolveKeyOwners([...allPublicKeys]);

    const entries: SigningReportItemDto[] = [];

    for (const tx of transactions) {
      const txSignerKeyIds = signersByTx.get(tx.id) ?? new Set<number>();

      for (const source of sourcesByTx.get(tx.id) ?? []) {
        const seen = new Set<string>();

        for (const publicKey of source.publicKeys) {
          if (seen.has(publicKey)) continue;
          seen.add(publicKey);

          const owner = keyToOwner.get(publicKey) ?? null;

          // For the user report, only include keys that belong to the queried user.
          if (options.userFilter !== undefined && owner?.userId !== options.userFilter) continue;

          const signed = owner != null && txSignerKeyIds.has(owner.userKeyId);

          entries.push({
            transactionId: tx.id,
            createdAt: tx.createdAt.toISOString(),
            validStart: tx.validStart.toISOString(),
            executedAt: tx.executedAt?.toISOString() ?? null,
            entityType: source.entityType,
            entityId: source.entityId,
            publicKey,
            userId: owner?.userId ?? null,
            userEmail: owner?.userEmail ?? null,
            signingStatus: signed ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
          });
        }
      }
    }

    return entries.sort(byReportOrder);
  }

  /**
   * Flattens a transaction's keys into account/node key sources. Executed
   * transactions read from immutable snapshots; unexecuted ones read from the
   * live account/node cache. When an account filter is set (the account report)
   * only that account is included and node keys are omitted.
   */
  private collectKeySources(tx: Transaction, options: ReportOptions): KeySource[] {
    if (!tx.executedAt) {
      return options.includeUnexecuted ? this.collectCachedKeySources(tx, options.accountFilter) : [];
    }
    return this.collectSnapshotKeySources(tx, options.accountFilter);
  }

  private collectSnapshotKeySources(tx: Transaction, accountFilter?: string): KeySource[] {
    const sources: KeySource[] = [];

    for (const tas of tx.transactionAccountSnapshots ?? []) {
      const snapshot = tas.accountSnapshot;
      if (!snapshot) continue;
      if (accountFilter && snapshot.account !== accountFilter) continue;

      // A receiver account only needs to sign when it requires a signature.
      if (tas.isReceiver && !snapshot.receiverSignatureRequired) continue;

      sources.push({
        entityType: SigningEntityType.ACCOUNT,
        entityId: snapshot.account,
        publicKeys: snapshot.publicKeys ?? [],
      });
    }

    if (accountFilter) return sources;

    for (const tns of tx.transactionNodeSnapshots ?? []) {
      const snapshot = tns.nodeSnapshot;
      if (!snapshot) continue;

      sources.push({
        entityType: SigningEntityType.NODE,
        entityId: String(snapshot.nodeId),
        publicKeys: snapshot.publicKeys ?? [],
      });
    }

    return sources;
  }

  private collectCachedKeySources(tx: Transaction, accountFilter?: string): KeySource[] {
    const sources: KeySource[] = [];

    for (const tca of tx.transactionCachedAccounts ?? []) {
      const cachedAccount = tca.cachedAccount;
      if (!cachedAccount) continue;
      if (accountFilter && cachedAccount.account !== accountFilter) continue;

      // A receiver account only needs to sign when it requires a signature.
      if (tca.isReceiver && !cachedAccount.receiverSignatureRequired) continue;

      sources.push({
        entityType: SigningEntityType.ACCOUNT,
        entityId: cachedAccount.account,
        publicKeys: (cachedAccount.keys ?? []).map(key => key.publicKey),
      });
    }

    if (accountFilter) return sources;

    for (const tcn of tx.transactionCachedNodes ?? []) {
      const cachedNode = tcn.cachedNode;
      if (!cachedNode) continue;

      sources.push({
        entityType: SigningEntityType.NODE,
        entityId: String(cachedNode.nodeId),
        publicKeys: (cachedNode.keys ?? []).map(key => key.publicKey),
      });
    }

    return sources;
  }

  /**
   * Bulk-resolves public keys to their owning UserKey. A public key maps to at
   * most one UserKey, bound to a single owner: the upload path reuses (recovers)
   * the existing row for a given public key rather than inserting a duplicate,
   * and rejects uploads of a key owned by another user. If key sharing is added
   * later this would become a one-to-many lookup; that change lives here and in
   * the per-key emission loop in buildReport.
   *
   * publicKey has no unique DB constraint, so should duplicate rows ever exist
   * the query orders deterministically (non-deleted first, then latest id) and
   * we keep the first match per key rather than overwriting arbitrarily.
   */
  private async resolveKeyOwners(
    publicKeys: string[],
  ): Promise<Map<string, { userId: number; userEmail: string; userKeyId: number }>> {
    const keyToOwner = new Map<string, { userId: number; userEmail: string; userKeyId: number }>();

    if (publicKeys.length === 0) return keyToOwner;

    const userKeys = await this.userKeyRepo
      .createQueryBuilder('uk')
      .leftJoinAndSelect('uk.user', 'user')
      .where('uk.publicKey IN (:...publicKeys)', { publicKeys })
      .withDeleted()
      .orderBy('uk.deletedAt', 'ASC', 'NULLS FIRST')
      .addOrderBy('uk.id', 'DESC')
      .getMany();

    for (const userKey of userKeys) {
      if (!userKey.user) continue;
      if (keyToOwner.has(userKey.publicKey)) continue;
      keyToOwner.set(userKey.publicKey, {
        userId: userKey.userId,
        userEmail: userKey.user.email,
        userKeyId: userKey.id,
      });
    }

    return keyToOwner;
  }

  private parseNumericId(id: string): number {
    // Require the entire string to be digits so partially-numeric ids like
    // '1.5' or '123abc' are rejected rather than silently truncated by parseInt.
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException(`Invalid id: ${id}`);
    }
    const parsed = Number.parseInt(id, 10);
    if (parsed <= 0) {
      throw new BadRequestException(`Invalid id: ${id}`);
    }
    return parsed;
  }

  // Required for the account/user reports, whose identifiers are network-relative.
  private requireMirrorNetwork(mirrorNetwork?: string): string {
    if (!mirrorNetwork) {
      throw new BadRequestException('mirrorNetwork is required for this report type');
    }
    return mirrorNetwork;
  }

  private parseDateRange(startDate?: Date, endDate?: Date): { start: Date; end: Date } {
    if (!startDate) throw new BadRequestException('startDate is required for this report type');

    // Advance to the start of the next day so endDate is inclusive of its whole day.
    const end = endDate ? new Date(endDate) : new Date();
    end.setUTCDate(end.getUTCDate() + 1);
    end.setUTCHours(0, 0, 0, 0);

    if (startDate >= end) throw new BadRequestException('startDate must be before endDate');

    return { start: startDate, end };
  }
}
