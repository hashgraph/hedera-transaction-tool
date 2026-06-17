import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockDeep } from 'jest-mock-extended';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';

import {
  AccountSnapshot,
  NodeSnapshot,
  TransactionAccountSnapshot,
  TransactionCachedAccount,
  TransactionCachedNode,
  TransactionNodeSnapshot,
} from '@entities';

import { TransactionSnapshotService } from './transaction-snapshot.service';

describe('TransactionSnapshotService', () => {
  let service: TransactionSnapshotService;

  const accountSnapshotRepo = mockDeep<Repository<AccountSnapshot>>();
  const nodeSnapshotRepo = mockDeep<Repository<NodeSnapshot>>();
  const transactionAccountSnapshotRepo = mockDeep<Repository<TransactionAccountSnapshot>>();
  const transactionNodeSnapshotRepo = mockDeep<Repository<TransactionNodeSnapshot>>();
  const transactionCachedAccountRepo = mockDeep<Repository<TransactionCachedAccount>>();
  const transactionCachedNodeRepo = mockDeep<Repository<TransactionCachedNode>>();

  const setupInsertQb = (repo: { createQueryBuilder: jest.Mock }) => {
    const qb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ raw: [] }),
    };
    repo.createQueryBuilder.mockReturnValue(qb as any);
    return qb;
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    setupInsertQb(transactionAccountSnapshotRepo);
    setupInsertQb(transactionNodeSnapshotRepo);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionSnapshotService,
        { provide: getRepositoryToken(AccountSnapshot), useValue: accountSnapshotRepo as any },
        { provide: getRepositoryToken(NodeSnapshot), useValue: nodeSnapshotRepo as any },
        { provide: getRepositoryToken(TransactionAccountSnapshot), useValue: transactionAccountSnapshotRepo as any },
        { provide: getRepositoryToken(TransactionNodeSnapshot), useValue: transactionNodeSnapshotRepo as any },
        { provide: getRepositoryToken(TransactionCachedAccount), useValue: transactionCachedAccountRepo as any },
        { provide: getRepositoryToken(TransactionCachedNode), useValue: transactionCachedNodeRepo as any },
      ],
    }).compile();

    service = module.get<TransactionSnapshotService>(TransactionSnapshotService);
  });

  // Helpers
  const encodedAccountKey = Buffer.from('account-key');
  const accountKeyHash = createHash('sha256').update(encodedAccountKey).digest('hex');

  const encodedNodeKey = Buffer.from('node-key');
  const nodeKeyHash = createHash('sha256').update(encodedNodeKey).digest('hex');

  const makeAccountLink = (opts: {
    encodedKey?: Buffer | null;
    receiverSignatureRequired?: boolean | null;
    isReceiver?: boolean;
  } = {}) => ({
    transactionId: 1,
    isReceiver: opts.isReceiver ?? false,
    cachedAccount: {
      account: '0.0.1',
      mirrorNetwork: 'testnet',
      encodedKey: opts.encodedKey !== undefined ? opts.encodedKey : encodedAccountKey,
      receiverSignatureRequired: opts.receiverSignatureRequired !== undefined
        ? opts.receiverSignatureRequired
        : false,
    },
  });

  const makeNodeLink = (opts: { encodedKey?: Buffer | null } = {}) => ({
    transactionId: 1,
    cachedNode: {
      nodeId: 5,
      mirrorNetwork: 'testnet',
      encodedKey: opts.encodedKey !== undefined ? opts.encodedKey : encodedNodeKey,
    },
  });

  describe('captureForTransaction', () => {
    it('should query cached accounts and nodes for the transaction', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([]);
      transactionCachedNodeRepo.find.mockResolvedValue([]);

      await service.captureForTransaction(42);

      expect(transactionCachedAccountRepo.find).toHaveBeenCalledWith({
        where: { transactionId: 42 },
        relations: { cachedAccount: true },
      });
      expect(transactionCachedNodeRepo.find).toHaveBeenCalledWith({
        where: { transactionId: 42 },
        relations: { cachedNode: true },
      });
    });

    it('should swallow errors and not rethrow', async () => {
      transactionCachedAccountRepo.find.mockRejectedValue(new Error('DB unavailable'));
      transactionCachedNodeRepo.find.mockResolvedValue([]);

      await expect(service.captureForTransaction(1)).resolves.toBeUndefined();
    });
  });

  describe('account snapshot capture', () => {
    beforeEach(() => {
      transactionCachedNodeRepo.find.mockResolvedValue([]);
    });

    it('should skip accounts with null encodedKey', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink({ encodedKey: null })] as any);

      await service.captureForTransaction(1);

      expect(accountSnapshotRepo.findOne).not.toHaveBeenCalled();
      expect(accountSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should insert a new snapshot when no prior row exists', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue(null);
      accountSnapshotRepo.save.mockResolvedValue({ id: 10 } as any);

      await service.captureForTransaction(1);

      expect(accountSnapshotRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          account: '0.0.1',
          mirrorNetwork: 'testnet',
          keyHash: accountKeyHash,
          receiverSignatureRequired: false,
        }),
      );
      const qb = transactionAccountSnapshotRepo.createQueryBuilder();
      expect((qb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({ transactionId: 1, keySnapshotId: 10, isReceiver: false }),
      );
    });

    it('should reuse the latest snapshot when key and receiverSignatureRequired are unchanged', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 99, keyHash: accountKeyHash, receiverSignatureRequired: false,
      } as any);

      await service.captureForTransaction(1);

      expect(accountSnapshotRepo.save).not.toHaveBeenCalled();
      const qb = transactionAccountSnapshotRepo.createQueryBuilder();
      expect((qb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({ keySnapshotId: 99 }),
      );
    });

    it('should query the latest snapshot by account and mirrorNetwork ordered by createdAt DESC', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue(null);
      accountSnapshotRepo.save.mockResolvedValue({ id: 1 } as any);

      await service.captureForTransaction(1);

      expect(accountSnapshotRepo.findOne).toHaveBeenCalledWith({
        where: { account: '0.0.1', mirrorNetwork: 'testnet' },
        order: { createdAt: 'DESC' },
        select: { id: true, keyHash: true, receiverSignatureRequired: true },
      });
    });

    it('should treat an exact keyHash match as unchanged (no insert)', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 88, keyHash: accountKeyHash, receiverSignatureRequired: false,
      } as any);

      await service.captureForTransaction(1);

      expect(accountSnapshotRepo.save).not.toHaveBeenCalled();
      const qb = transactionAccountSnapshotRepo.createQueryBuilder();
      expect((qb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({ keySnapshotId: 88 }),
      );
    });

    it('should process all accounts in the transaction, not just the first', async () => {
      const key2 = Buffer.from('account-key-2');
      const keyHash2 = createHash('sha256').update(key2).digest('hex');

      transactionCachedAccountRepo.find.mockResolvedValue([
        makeAccountLink(),
        { transactionId: 1, isReceiver: false, cachedAccount: { account: '0.0.2', mirrorNetwork: 'testnet', encodedKey: key2, receiverSignatureRequired: false } },
      ] as any);
      accountSnapshotRepo.findOne.mockResolvedValue(null);
      accountSnapshotRepo.save
        .mockResolvedValueOnce({ id: 20 } as any)
        .mockResolvedValueOnce({ id: 21 } as any);

      await service.captureForTransaction(1);

      expect(accountSnapshotRepo.save).toHaveBeenCalledTimes(2);
      expect(accountSnapshotRepo.save).toHaveBeenCalledWith(expect.objectContaining({ account: '0.0.1', keyHash: accountKeyHash }));
      expect(accountSnapshotRepo.save).toHaveBeenCalledWith(expect.objectContaining({ account: '0.0.2', keyHash: keyHash2 }));

      const qb = transactionAccountSnapshotRepo.createQueryBuilder();
      expect((qb as any).values).toHaveBeenCalledTimes(2);
    });

    it('should insert a new snapshot when the key changes', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 1, keyHash: 'a'.repeat(64), receiverSignatureRequired: false,
      } as any);
      accountSnapshotRepo.save.mockResolvedValue({ id: 11 } as any);

      await service.captureForTransaction(1);

      expect(accountSnapshotRepo.save).toHaveBeenCalled();
    });

    it('should insert a new snapshot when receiverSignatureRequired changes', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 1, keyHash: accountKeyHash, receiverSignatureRequired: true,
      } as any);
      accountSnapshotRepo.save.mockResolvedValue({ id: 12 } as any);

      await service.captureForTransaction(1);

      expect(accountSnapshotRepo.save).toHaveBeenCalled();
    });

    it('should coerce null receiverSignatureRequired to false', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue(
        [makeAccountLink({ receiverSignatureRequired: null })] as any,
      );
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 77, keyHash: accountKeyHash, receiverSignatureRequired: false,
      } as any);

      await service.captureForTransaction(1);

      // null coerced to false matches existing false row — should reuse, not insert
      expect(accountSnapshotRepo.save).not.toHaveBeenCalled();
      const qb = transactionAccountSnapshotRepo.createQueryBuilder();
      expect((qb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({ keySnapshotId: 77 }),
      );
    });

    it('should pass isReceiver correctly to the join row', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue(
        [makeAccountLink({ isReceiver: true })] as any,
      );
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 5, keyHash: accountKeyHash, receiverSignatureRequired: false,
      } as any);

      await service.captureForTransaction(1);

      const qb = transactionAccountSnapshotRepo.createQueryBuilder();
      expect((qb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({ isReceiver: true }),
      );
    });
  });

  describe('node snapshot capture', () => {
    beforeEach(() => {
      transactionCachedAccountRepo.find.mockResolvedValue([]);
    });

    it('should skip nodes with null encodedKey', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink({ encodedKey: null })] as any);

      await service.captureForTransaction(1);

      expect(nodeSnapshotRepo.findOne).not.toHaveBeenCalled();
      expect(nodeSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should insert a new snapshot when no prior row exists', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue(null);
      nodeSnapshotRepo.save.mockResolvedValue({ id: 200 } as any);

      await service.captureForTransaction(1);

      expect(nodeSnapshotRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: 5, mirrorNetwork: 'testnet', keyHash: nodeKeyHash }),
      );
      const qb = transactionNodeSnapshotRepo.createQueryBuilder();
      expect((qb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({ transactionId: 1, keySnapshotId: 200 }),
      );
    });

    it('should reuse the latest snapshot when the key is unchanged', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue({ id: 55, keyHash: nodeKeyHash } as any);

      await service.captureForTransaction(1);

      expect(nodeSnapshotRepo.save).not.toHaveBeenCalled();
      const qb = transactionNodeSnapshotRepo.createQueryBuilder();
      expect((qb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({ keySnapshotId: 55 }),
      );
    });

    it('should query the latest snapshot by nodeId and mirrorNetwork ordered by createdAt DESC', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue(null);
      nodeSnapshotRepo.save.mockResolvedValue({ id: 1 } as any);

      await service.captureForTransaction(1);

      expect(nodeSnapshotRepo.findOne).toHaveBeenCalledWith({
        where: { nodeId: 5, mirrorNetwork: 'testnet' },
        order: { createdAt: 'DESC' },
        select: { id: true, keyHash: true },
      });
    });

    it('should treat an exact keyHash match as unchanged (no insert)', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue({ id: 66, keyHash: nodeKeyHash } as any);

      await service.captureForTransaction(1);

      expect(nodeSnapshotRepo.save).not.toHaveBeenCalled();
      const qb = transactionNodeSnapshotRepo.createQueryBuilder();
      expect((qb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({ keySnapshotId: 66 }),
      );
    });

    it('should process all nodes in the transaction, not just the first', async () => {
      const key2 = Buffer.from('node-key-2');
      const keyHash2 = createHash('sha256').update(key2).digest('hex');

      transactionCachedNodeRepo.find.mockResolvedValue([
        makeNodeLink(),
        { transactionId: 1, cachedNode: { nodeId: 7, mirrorNetwork: 'testnet', encodedKey: key2 } },
      ] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue(null);
      nodeSnapshotRepo.save
        .mockResolvedValueOnce({ id: 300 } as any)
        .mockResolvedValueOnce({ id: 301 } as any);

      await service.captureForTransaction(1);

      expect(nodeSnapshotRepo.save).toHaveBeenCalledTimes(2);
      expect(nodeSnapshotRepo.save).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 5, keyHash: nodeKeyHash }));
      expect(nodeSnapshotRepo.save).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 7, keyHash: keyHash2 }));
    });

    it('should insert a new snapshot when the key changes', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue({ id: 1, keyHash: 'b'.repeat(64) } as any);
      nodeSnapshotRepo.save.mockResolvedValue({ id: 201 } as any);

      await service.captureForTransaction(1);

      expect(nodeSnapshotRepo.save).toHaveBeenCalled();
    });
  });
});
