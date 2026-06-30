import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockDeep } from 'jest-mock-extended';
import { Repository, SelectQueryBuilder } from 'typeorm';

import {
  AccountSnapshot,
  CachedAccount,
  CachedAccountKey,
  CachedNode,
  CachedNodeAdminKey,
  NodeSnapshot,
  Transaction,
  TransactionAccountSnapshot,
  TransactionCachedAccount,
  TransactionCachedNode,
  TransactionGroup,
  TransactionGroupItem,
  TransactionNodeSnapshot,
  TransactionSigner,
  User,
  UserKey,
} from '@entities';

import { SigningReportService } from './signing-report.service';
import { SigningEntityType, SigningReportType, SigningStatus } from './dto/signing-report.dto';

// ─── fixtures ────────────────────────────────────────────────────────────────

const MIRROR_NETWORK = 'testnet';
const CREATED_AT = new Date('2026-05-31T23:59:00.000Z');
const VALID_START = new Date('2026-06-01T00:00:00.000Z');
const EXECUTED_AT = new Date('2026-06-01T00:00:01.000Z');

const PK_ALICE = 'pk_alice';
const PK_BOB = 'pk_bob';
const PK_NODE = 'pk_node';
const PK_UNKNOWN = 'pk_unknown';

function makeUser(id: number, email: string): User {
  return { id, email } as User;
}

function makeUserKey(id: number, userId: number, pk: string, user?: User): UserKey {
  return { id, userId, publicKey: pk, deletedAt: null, user } as UserKey;
}

function makeAccountSnapshot(
  account: string,
  publicKeys: string[],
  receiverSignatureRequired = false,
): AccountSnapshot {
  return { account, mirrorNetwork: MIRROR_NETWORK, publicKeys, receiverSignatureRequired } as AccountSnapshot;
}

function makeNodeSnapshot(nodeId: number, publicKeys: string[]): NodeSnapshot {
  return { nodeId, mirrorNetwork: MIRROR_NETWORK, publicKeys } as NodeSnapshot;
}

function makeTas(accountSnapshot: AccountSnapshot, isReceiver = false): TransactionAccountSnapshot {
  return { accountSnapshot, isReceiver } as TransactionAccountSnapshot;
}

function makeTns(nodeSnapshot: NodeSnapshot): TransactionNodeSnapshot {
  return { nodeSnapshot } as TransactionNodeSnapshot;
}

function makeCachedAccount(
  account: string,
  publicKeys: string[],
  receiverSignatureRequired = false,
): CachedAccount {
  return {
    account,
    mirrorNetwork: MIRROR_NETWORK,
    receiverSignatureRequired,
    keys: publicKeys.map(publicKey => ({ publicKey }) as CachedAccountKey),
  } as CachedAccount;
}

function makeCachedNode(nodeId: number, publicKeys: string[]): CachedNode {
  return {
    nodeId,
    mirrorNetwork: MIRROR_NETWORK,
    keys: publicKeys.map(publicKey => ({ publicKey }) as CachedNodeAdminKey),
  } as CachedNode;
}

function makeTca(cachedAccount: CachedAccount, isReceiver = false): TransactionCachedAccount {
  return { cachedAccount, isReceiver } as TransactionCachedAccount;
}

function makeTcn(cachedNode: CachedNode): TransactionCachedNode {
  return { cachedNode } as TransactionCachedNode;
}

function makeTx(
  id: number,
  opts: {
    accounts?: TransactionAccountSnapshot[];
    nodes?: TransactionNodeSnapshot[];
    cachedAccounts?: TransactionCachedAccount[];
    cachedNodes?: TransactionCachedNode[];
    executedAt?: Date | null;
  } = {},
): Transaction {
  return {
    id,
    createdAt: CREATED_AT,
    validStart: VALID_START,
    executedAt: opts.executedAt === null ? undefined : (opts.executedAt ?? EXECUTED_AT),
    mirrorNetwork: MIRROR_NETWORK,
    transactionAccountSnapshots: opts.accounts ?? [],
    transactionNodeSnapshots: opts.nodes ?? [],
    transactionCachedAccounts: opts.cachedAccounts ?? [],
    transactionCachedNodes: opts.cachedNodes ?? [],
  } as Transaction;
}

function makeSigner(transactionId: number, userKeyId: number): TransactionSigner {
  return { transactionId, userKeyId } as TransactionSigner;
}

// QueryBuilder mock where every chain method returns `this`.
function makeQb<T>(): ReturnType<typeof mockDeep<SelectQueryBuilder<T>>> {
  const qb = mockDeep<SelectQueryBuilder<T>>();
  for (const m of [
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'limit',
    'innerJoin',
    'leftJoinAndSelect',
    'select',
    'distinct',
    'withDeleted',
  ]) {
    (qb as any)[m].mockReturnThis();
  }
  return qb;
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('SigningReportService', () => {
  let service: SigningReportService;

  const transactionRepo = mockDeep<Repository<Transaction>>();
  const txAccountSnapshotRepo = mockDeep<Repository<TransactionAccountSnapshot>>();
  const txNodeSnapshotRepo = mockDeep<Repository<TransactionNodeSnapshot>>();
  const txCachedAccountRepo = mockDeep<Repository<TransactionCachedAccount>>();
  const txCachedNodeRepo = mockDeep<Repository<TransactionCachedNode>>();
  const transactionGroupRepo = mockDeep<Repository<TransactionGroup>>();
  const transactionGroupItemRepo = mockDeep<Repository<TransactionGroupItem>>();
  const transactionSignerRepo = mockDeep<Repository<TransactionSigner>>();
  const userKeyRepo = mockDeep<Repository<UserKey>>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SigningReportService,
        { provide: getRepositoryToken(Transaction), useValue: transactionRepo },
        { provide: getRepositoryToken(TransactionAccountSnapshot), useValue: txAccountSnapshotRepo },
        { provide: getRepositoryToken(TransactionNodeSnapshot), useValue: txNodeSnapshotRepo },
        { provide: getRepositoryToken(TransactionCachedAccount), useValue: txCachedAccountRepo },
        { provide: getRepositoryToken(TransactionCachedNode), useValue: txCachedNodeRepo },
        { provide: getRepositoryToken(TransactionGroup), useValue: transactionGroupRepo },
        { provide: getRepositoryToken(TransactionGroupItem), useValue: transactionGroupItemRepo },
        { provide: getRepositoryToken(TransactionSigner), useValue: transactionSignerRepo },
        { provide: getRepositoryToken(UserKey), useValue: userKeyRepo },
      ],
    }).compile();

    service = module.get(SigningReportService);
    jest.resetAllMocks();
  });

  // Default wiring: Alice/Bob/node-owner own their keys (unknown owns none).
  function wireOwners(userKeys: UserKey[] = defaultUserKeys()) {
    const qb = makeQb<UserKey>();
    (qb as any).getMany.mockResolvedValue(userKeys);
    userKeyRepo.createQueryBuilder.mockReturnValue(qb as any);
  }

  function defaultUserKeys(): UserKey[] {
    return [
      makeUserKey(1, 7, PK_ALICE, makeUser(7, 'alice@example.com')),
      makeUserKey(2, 8, PK_BOB, makeUser(8, 'bob@example.com')),
      makeUserKey(3, 9, PK_NODE, makeUser(9, 'node-admin@example.com')),
    ];
  }

  function wireSigners(signers: TransactionSigner[]) {
    transactionSignerRepo.find.mockResolvedValue(signers);
  }

  function wireRawTxIds(repo: { createQueryBuilder: any }, transactionIds: number[]) {
    const qb = makeQb<TransactionAccountSnapshot>();
    (qb as any).getRawMany.mockResolvedValue(transactionIds.map(transactionId => ({ transactionId })));
    repo.createQueryBuilder.mockReturnValue(qb as any);
  }

  it('should be defined', () => expect(service).toBeDefined());

  describe('type=transaction', () => {
    it('flattens per-account keys with user info and signing status', async () => {
      const tx = makeTx(1, { accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE, PK_BOB]))] });

      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([makeSigner(1, 1)]); // Alice's userKey (id 1) signed
      wireOwners();

      const result = await service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '1' });

      expect(result).toEqual([
        {
          transactionId: 1,
          createdAt: CREATED_AT.toISOString(),
          validStart: VALID_START.toISOString(),
          executedAt: EXECUTED_AT.toISOString(),
          entityType: SigningEntityType.ACCOUNT,
          entityId: '0.0.100',
          publicKey: PK_ALICE,
          userId: 7,
          userEmail: 'alice@example.com',
          signingStatus: SigningStatus.SIGNED,
        },
        {
          transactionId: 1,
          createdAt: CREATED_AT.toISOString(),
          validStart: VALID_START.toISOString(),
          executedAt: EXECUTED_AT.toISOString(),
          entityType: SigningEntityType.ACCOUNT,
          entityId: '0.0.100',
          publicKey: PK_BOB,
          userId: 8,
          userEmail: 'bob@example.com',
          signingStatus: SigningStatus.NOT_SIGNED,
        },
      ]);
    });

    it('includes node admin keys for the transaction', async () => {
      const tx = makeTx(1, {
        accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE]))],
        nodes: [makeTns(makeNodeSnapshot(3, [PK_NODE]))],
      });

      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([makeSigner(1, 3)]); // node admin key signed
      wireOwners();

      const result = await service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '1' });

      expect(result).toEqual([
        expect.objectContaining({
          entityType: SigningEntityType.ACCOUNT,
          entityId: '0.0.100',
          publicKey: PK_ALICE,
          signingStatus: SigningStatus.NOT_SIGNED,
        }),
        expect.objectContaining({
          entityType: SigningEntityType.NODE,
          entityId: '3',
          publicKey: PK_NODE,
          userId: 9,
          userEmail: 'node-admin@example.com',
          signingStatus: SigningStatus.SIGNED,
        }),
      ]);
    });

    it('includes keys with no matching UserKey with null user fields', async () => {
      const tx = makeTx(1, { accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_UNKNOWN]))] });

      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([]);
      wireOwners([]); // no UserKey records

      const result = await service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '1' });

      expect(result).toEqual([
        expect.objectContaining({
          publicKey: PK_UNKNOWN,
          userId: null,
          userEmail: null,
          signingStatus: SigningStatus.NOT_SIGNED,
        }),
      ]);
    });

    it('throws when the transaction does not exist', async () => {
      transactionRepo.find.mockResolvedValue([]);
      await expect(
        service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '99' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(['abc', '1.5', '123abc', '0', '-1', ''])(
      'rejects a non-positive-integer id (%p)',
      async id => {
        await expect(
          service.getSigningReport({ type: SigningReportType.TRANSACTION, id }),
        ).rejects.toBeInstanceOf(BadRequestException);
      },
    );

    it('skips receiver accounts that do not require a signature', async () => {
      const tx = makeTx(1, { accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE]), true)] });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '1' });
      expect(result).toEqual([]);
    });
  });

  describe('type=group', () => {
    it('reports across all transactions in the group', async () => {
      transactionGroupRepo.findOne.mockResolvedValue({ id: 5 } as TransactionGroup);
      transactionGroupItemRepo.find.mockResolvedValue([
        { transactionId: 1 } as TransactionGroupItem,
        { transactionId: 2 } as TransactionGroupItem,
      ]);

      transactionRepo.find.mockResolvedValue([
        makeTx(1, { accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE]))] }),
        makeTx(2, { nodes: [makeTns(makeNodeSnapshot(4, [PK_NODE]))] }),
      ]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({ type: SigningReportType.GROUP, id: '5' });

      expect(result.map(r => r.transactionId)).toEqual([1, 2]);
      expect(result.map(r => r.publicKey)).toEqual([PK_ALICE, PK_NODE]);
      expect(result.map(r => r.entityType)).toEqual([
        SigningEntityType.ACCOUNT,
        SigningEntityType.NODE,
      ]);
    });

    it('throws when the group does not exist', async () => {
      transactionGroupRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getSigningReport({ type: SigningReportType.GROUP, id: '5' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('type=account', () => {
    it('selects transactions touching the account and only reports that account, no nodes', async () => {
      wireRawTxIds(txAccountSnapshotRepo, [1]);

      // Transaction touches two accounts and a node; only the queried account appears.
      const tx = makeTx(1, {
        accounts: [
          makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE])),
          makeTas(makeAccountSnapshot('0.0.999', [PK_BOB])),
        ],
        nodes: [makeTns(makeNodeSnapshot(3, [PK_NODE]))],
      });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({
        type: SigningReportType.ACCOUNT,
        mirrorNetwork: MIRROR_NETWORK,
        id: '0.0.100',
        startDate: VALID_START,
      });

      expect(result.map(r => r.publicKey)).toEqual([PK_ALICE]);
      expect(result.every(r => r.entityType === SigningEntityType.ACCOUNT)).toBe(true);
    });

    it('requires a startDate', async () => {
      await expect(
        service.getSigningReport({ mirrorNetwork: MIRROR_NETWORK, type: SigningReportType.ACCOUNT, id: '0.0.100' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a mirrorNetwork', async () => {
      await expect(
        service.getSigningReport({ type: SigningReportType.ACCOUNT, id: '0.0.100', startDate: VALID_START }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('type=user', () => {
    it('reports the user keys from both account and node snapshots', async () => {
      userKeyRepo.find.mockResolvedValue([
        makeUserKey(1, 7, PK_ALICE),
        makeUserKey(3, 7, PK_NODE),
      ]);

      wireRawTxIds(txAccountSnapshotRepo, [1]);
      wireRawTxIds(txNodeSnapshotRepo, [1]);

      const tx = makeTx(1, {
        accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE, PK_BOB]))],
        nodes: [makeTns(makeNodeSnapshot(3, [PK_NODE]))],
      });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([makeSigner(1, 1)]);
      wireOwners([
        makeUserKey(1, 7, PK_ALICE, makeUser(7, 'alice@example.com')),
        makeUserKey(2, 8, PK_BOB, makeUser(8, 'bob@example.com')),
        makeUserKey(3, 7, PK_NODE, makeUser(7, 'alice@example.com')),
      ]);

      const result = await service.getSigningReport({
        type: SigningReportType.USER,
        mirrorNetwork: MIRROR_NETWORK,
        id: '7',
        startDate: VALID_START,
      });

      // Bob's key is excluded (different user); Alice's account + node keys remain.
      expect(result.map(r => r.publicKey).sort()).toEqual([PK_ALICE, PK_NODE]);
      expect(result.every(r => r.userId === 7)).toBe(true);
    });

    it('returns empty when the user has no keys', async () => {
      userKeyRepo.find.mockResolvedValue([]);
      const result = await service.getSigningReport({
        type: SigningReportType.USER,
        mirrorNetwork: MIRROR_NETWORK,
        id: '7',
        startDate: VALID_START,
      });
      expect(result).toEqual([]);
    });

    it('requires a mirrorNetwork', async () => {
      await expect(
        service.getSigningReport({ type: SigningReportType.USER, id: '7', startDate: VALID_START }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a startDate', async () => {
      await expect(
        service.getSigningReport({ type: SigningReportType.USER, id: '7', mirrorNetwork: MIRROR_NETWORK }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('completedOnly', () => {
    it('excludes not-yet-complete transactions by default', async () => {
      const tx = makeTx(1, {
        executedAt: null,
        cachedAccounts: [makeTca(makeCachedAccount('0.0.100', [PK_ALICE]))],
      });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '1' });
      expect(result).toEqual([]);
    });

    it('reads keys from the live cache for unexecuted transactions when requested', async () => {
      const tx = makeTx(1, {
        executedAt: null,
        cachedAccounts: [makeTca(makeCachedAccount('0.0.100', [PK_ALICE]))],
        cachedNodes: [makeTcn(makeCachedNode(3, [PK_NODE]))],
      });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({
        type: SigningReportType.TRANSACTION,
        mirrorNetwork: MIRROR_NETWORK,
        id: '1',
        completedOnly: false,
      });

      expect(result.map(r => r.publicKey)).toEqual([PK_ALICE, PK_NODE]);
      expect(result.map(r => r.entityType)).toEqual([
        SigningEntityType.ACCOUNT,
        SigningEntityType.NODE,
      ]);
      expect(result.every(r => r.executedAt === null)).toBe(true);
    });

    it('account report unions executed snapshots with pending cached accounts', async () => {
      wireRawTxIds(txAccountSnapshotRepo, [1]); // executed match
      wireRawTxIds(txCachedAccountRepo, [2]); // pending match

      transactionRepo.find.mockResolvedValue([
        makeTx(1, { accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE]))] }),
        makeTx(2, {
          executedAt: null,
          cachedAccounts: [
            makeTca(makeCachedAccount('0.0.100', [PK_BOB])),
            makeTca(makeCachedAccount('0.0.999', [PK_ALICE])), // other account, filtered out
          ],
        }),
      ]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({
        type: SigningReportType.ACCOUNT,
        mirrorNetwork: MIRROR_NETWORK,
        id: '0.0.100',
        startDate: VALID_START,
        completedOnly: false,
      });

      // tx 2 reports only the queried account, not the unrelated 0.0.999.
      expect(result.map(r => r.transactionId)).toEqual([1, 2]);
      expect(result.every(r => r.entityId === '0.0.100')).toBe(true);
      expect(transactionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ mirrorNetwork: MIRROR_NETWORK }),
        }),
      );
    });

    it('skips receiver accounts that do not require a signature on the cached path', async () => {
      const tx = makeTx(1, {
        executedAt: null,
        cachedAccounts: [makeTca(makeCachedAccount('0.0.100', [PK_ALICE]), true)],
      });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({
        type: SigningReportType.TRANSACTION,
        mirrorNetwork: MIRROR_NETWORK,
        id: '1',
        completedOnly: false,
      });
      expect(result).toEqual([]);
    });

    it('unions the user keys from pending account and node caches', async () => {
      userKeyRepo.find.mockResolvedValue([makeUserKey(1, 7, PK_ALICE), makeUserKey(3, 7, PK_NODE)]);

      // No executed matches; both pending cache selections match tx 1.
      wireRawTxIds(txAccountSnapshotRepo, []);
      wireRawTxIds(txNodeSnapshotRepo, []);
      wireRawTxIds(txCachedAccountRepo, [1]);
      wireRawTxIds(txCachedNodeRepo, [1]);

      const tx = makeTx(1, {
        executedAt: null,
        cachedAccounts: [makeTca(makeCachedAccount('0.0.100', [PK_ALICE]))],
        cachedNodes: [makeTcn(makeCachedNode(3, [PK_NODE]))],
      });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([makeSigner(1, 3)]); // node key signed
      wireOwners([
        makeUserKey(1, 7, PK_ALICE, makeUser(7, 'alice@example.com')),
        makeUserKey(3, 7, PK_NODE, makeUser(7, 'alice@example.com')),
      ]);

      const result = await service.getSigningReport({
        type: SigningReportType.USER,
        mirrorNetwork: MIRROR_NETWORK,
        id: '7',
        startDate: VALID_START,
        completedOnly: false,
      });

      expect(result.map(r => r.publicKey).sort()).toEqual([PK_ALICE, PK_NODE]);
      expect(result.find(r => r.publicKey === PK_NODE)?.signingStatus).toBe(SigningStatus.SIGNED);
      expect(result.find(r => r.publicKey === PK_ALICE)?.signingStatus).toBe(SigningStatus.NOT_SIGNED);
    });
  });

  describe('key owner resolution', () => {
    it('keeps the first match per public key when duplicate UserKey rows exist', async () => {
      const tx = makeTx(1, { accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE]))] });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([makeSigner(1, 9)]); // signed with the kept (active) row's id

      // The query orders non-deleted first, latest id first; the loop keeps the
      // first match, so the active row (id 9) wins over the deleted one (id 5).
      wireOwners([
        makeUserKey(9, 7, PK_ALICE, makeUser(7, 'alice@example.com')),
        {
          id: 5,
          userId: 7,
          publicKey: PK_ALICE,
          deletedAt: new Date(),
          user: makeUser(7, 'old@example.com'),
        } as UserKey,
      ]);

      const result = await service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '1' });

      expect(result).toEqual([
        expect.objectContaining({
          publicKey: PK_ALICE,
          userId: 7,
          userEmail: 'alice@example.com',
          signingStatus: SigningStatus.SIGNED,
        }),
      ]);
    });
  });

  it('rejects an unknown report type', async () => {
    await expect(
      service.getSigningReport({ type: 'bogus' as SigningReportType, id: '1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('date range', () => {
    it('rejects a startDate that is on or after the endDate', async () => {
      await expect(
        service.getSigningReport({
          type: SigningReportType.ACCOUNT,
          mirrorNetwork: MIRROR_NETWORK,
          id: '0.0.100',
          startDate: new Date('2026-06-10T00:00:00.000Z'),
          endDate: new Date('2026-06-01T00:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('edge cases', () => {
    it('returns empty for a group with no transactions', async () => {
      transactionGroupRepo.findOne.mockResolvedValue({ id: 5 } as TransactionGroup);
      transactionGroupItemRepo.find.mockResolvedValue([]);
      wireSigners([]);

      const result = await service.getSigningReport({ type: SigningReportType.GROUP, id: '5' });
      expect(result).toEqual([]);
    });

    it('skips missing snapshot relations and treats null publicKeys as empty', async () => {
      const tx = makeTx(1, {
        accounts: [
          makeTas(null as unknown as AccountSnapshot), // missing snapshot
          makeTas(makeAccountSnapshot('0.0.100', null as unknown as string[])), // null publicKeys
        ],
        nodes: [
          makeTns(null as unknown as NodeSnapshot), // missing node snapshot
          makeTns(makeNodeSnapshot(3, null as unknown as string[])), // null node publicKeys
        ],
      });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '1' });
      expect(result).toEqual([]);
    });

    it('skips missing cached relations and treats null keys as empty', async () => {
      const tx = makeTx(1, {
        executedAt: null,
        cachedAccounts: [
          makeTca(null as unknown as CachedAccount), // missing cached account
          makeTca({ account: '0.0.100' } as CachedAccount), // null keys
        ],
        cachedNodes: [
          makeTcn(null as unknown as CachedNode), // missing cached node
          makeTcn({ nodeId: 3 } as CachedNode), // null keys
        ],
      });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({
        type: SigningReportType.TRANSACTION,
        id: '1',
        completedOnly: false,
      });
      expect(result).toEqual([]);
    });

    it.each([
      ['executed', EXECUTED_AT, { completedOnly: true }],
      ['unexecuted', undefined, { completedOnly: false }],
    ])('tolerates a %s transaction whose relations were not loaded', async (_label, executedAt, opts) => {
      // Bare transaction (no relation arrays) exercises the `?? []` fallbacks on
      // both the snapshot and cached collection paths.
      const bare = {
        id: 1,
        createdAt: CREATED_AT,
        validStart: VALID_START,
        executedAt,
        mirrorNetwork: MIRROR_NETWORK,
      } as Transaction;
      transactionRepo.find.mockResolvedValue([bare]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({
        type: SigningReportType.TRANSACTION,
        id: '1',
        ...opts,
      });
      expect(result).toEqual([]);
    });

    it('ignores a UserKey row with no associated user', async () => {
      const tx = makeTx(1, { accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE]))] });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([]);
      wireOwners([makeUserKey(1, 7, PK_ALICE, undefined)]); // user relation not loaded/null

      const result = await service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '1' });
      expect(result).toEqual([
        expect.objectContaining({ publicKey: PK_ALICE, userId: null, userEmail: null }),
      ]);
    });

    it('de-duplicates a public key repeated within one source', async () => {
      const tx = makeTx(1, {
        accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE, PK_ALICE]))],
      });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([]);
      wireOwners();

      const result = await service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '1' });
      expect(result.filter(r => r.publicKey === PK_ALICE)).toHaveLength(1);
    });

    it('groups multiple signers belonging to the same transaction', async () => {
      const tx = makeTx(1, { accounts: [makeTas(makeAccountSnapshot('0.0.100', [PK_ALICE, PK_BOB]))] });
      transactionRepo.find.mockResolvedValue([tx]);
      wireSigners([makeSigner(1, 1), makeSigner(1, 2)]); // two signers, same tx
      wireOwners();

      const result = await service.getSigningReport({ type: SigningReportType.TRANSACTION, id: '1' });
      expect(result.every(r => r.signingStatus === SigningStatus.SIGNED)).toBe(true);
    });
  });
});
