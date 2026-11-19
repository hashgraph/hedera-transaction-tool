import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mockDeep } from 'jest-mock-extended';
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
  const transactionCachedAccountRepo = mockDeep<Repository<TransactionCachedAccount>>();
  const transactionCachedNodeRepo = mockDeep<Repository<TransactionCachedNode>>();
  const transactionAccountSnapshotRepo = mockDeep<Repository<TransactionAccountSnapshot>>();
  const transactionNodeSnapshotRepo = mockDeep<Repository<TransactionNodeSnapshot>>();

  const executedAt = new Date('2024-01-01T00:00:00Z');

  const makeInsertChain = () => {
    const chain = {
      insert: jest.fn(),
      into: jest.fn(),
      values: jest.fn(),
      orIgnore: jest.fn(),
      execute: jest.fn().mockResolvedValue({}),
    };
    chain.insert.mockReturnValue(chain);
    chain.into.mockReturnValue(chain);
    chain.values.mockReturnValue(chain);
    chain.orIgnore.mockReturnValue(chain);
    return chain;
  };

  let accountJoinChain: ReturnType<typeof makeInsertChain>;
  let nodeJoinChain: ReturnType<typeof makeInsertChain>;

  beforeEach(async () => {
    jest.resetAllMocks();

    accountJoinChain = makeInsertChain();
    nodeJoinChain = makeInsertChain();
    transactionAccountSnapshotRepo.createQueryBuilder.mockReturnValue(accountJoinChain as any);
    transactionNodeSnapshotRepo.createQueryBuilder.mockReturnValue(nodeJoinChain as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionSnapshotService,
        { provide: getRepositoryToken(AccountSnapshot), useValue: accountSnapshotRepo as any },
        { provide: getRepositoryToken(NodeSnapshot), useValue: nodeSnapshotRepo as any },
        { provide: getRepositoryToken(TransactionCachedAccount), useValue: transactionCachedAccountRepo as any },
        { provide: getRepositoryToken(TransactionCachedNode), useValue: transactionCachedNodeRepo as any },
        { provide: getRepositoryToken(TransactionAccountSnapshot), useValue: transactionAccountSnapshotRepo as any },
        { provide: getRepositoryToken(TransactionNodeSnapshot), useValue: transactionNodeSnapshotRepo as any },
      ],
    }).compile();

    service = module.get<TransactionSnapshotService>(TransactionSnapshotService);
  });

  // Helpers
  const encodedAccountKey = Buffer.from('account-key');

  const encodedNodeKey = Buffer.from('node-key');

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

      await service.captureForTransaction(42, executedAt);

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

      await expect(service.captureForTransaction(1, executedAt)).resolves.toBeUndefined();
    });
  });

  describe('account snapshot capture', () => {
    beforeEach(() => {
      transactionCachedNodeRepo.find.mockResolvedValue([]);
    });

    it('should skip accounts that have not been fetched yet (null key, null receiverSignatureRequired)', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([
        makeAccountLink({ encodedKey: null, receiverSignatureRequired: null }),
      ] as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountSnapshotRepo.findOne).not.toHaveBeenCalled();
      expect(accountSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should snapshot a fetched keyless account with a null key', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([
        makeAccountLink({ encodedKey: null, receiverSignatureRequired: false, isReceiver: true }),
      ] as any);
      accountSnapshotRepo.findOne.mockResolvedValue(null);
      accountSnapshotRepo.save.mockResolvedValue({ id: 10 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountSnapshotRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          account: '0.0.1',
          encodedKey: null,
          publicKeys: [],
          receiverSignatureRequired: false,
        }),
      );
    });

    it('should reuse the existing snapshot when a keyless account is unchanged', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([
        makeAccountLink({ encodedKey: null, receiverSignatureRequired: false }),
      ] as any);
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 77, encodedKey: null, receiverSignatureRequired: false,
      } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should insert a new snapshot when no prior row exists', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue(null);
      accountSnapshotRepo.save.mockResolvedValue({ id: 10 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountSnapshotRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          account: '0.0.1',
          mirrorNetwork: 'testnet',
          encodedKey: encodedAccountKey,
          receiverSignatureRequired: false,
          createdAt: executedAt,
        }),
      );
    });

    it('should reuse the latest snapshot when key and receiverSignatureRequired are unchanged', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 99, encodedKey: encodedAccountKey, receiverSignatureRequired: false,
      } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should query the latest snapshot by account and mirrorNetwork ordered by createdAt DESC', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue(null);
      accountSnapshotRepo.save.mockResolvedValue({ id: 1 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountSnapshotRepo.findOne).toHaveBeenCalledWith({
        where: { account: '0.0.1', mirrorNetwork: 'testnet' },
        order: { createdAt: 'DESC' },
        select: { id: true, encodedKey: true, receiverSignatureRequired: true },
      });
    });

    it('should treat an identical encodedKey as unchanged (no insert)', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 88, encodedKey: encodedAccountKey, receiverSignatureRequired: false,
      } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should process all accounts in the transaction, not just the first', async () => {
      const key2 = Buffer.from('account-key-2');

      transactionCachedAccountRepo.find.mockResolvedValue([
        makeAccountLink(),
        { transactionId: 1, isReceiver: false, cachedAccount: { account: '0.0.2', mirrorNetwork: 'testnet', encodedKey: key2, receiverSignatureRequired: false } },
      ] as any);
      accountSnapshotRepo.findOne.mockResolvedValue(null);
      accountSnapshotRepo.save
        .mockResolvedValueOnce({ id: 20 } as any)
        .mockResolvedValueOnce({ id: 21 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountSnapshotRepo.save).toHaveBeenCalledTimes(2);
      expect(accountSnapshotRepo.save).toHaveBeenCalledWith(expect.objectContaining({ account: '0.0.1', encodedKey: encodedAccountKey }));
      expect(accountSnapshotRepo.save).toHaveBeenCalledWith(expect.objectContaining({ account: '0.0.2', encodedKey: key2 }));
    });

    it('should insert a new snapshot when the key changes', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 1, encodedKey: Buffer.from('previous-key'), receiverSignatureRequired: false,
      } as any);
      accountSnapshotRepo.save.mockResolvedValue({ id: 11 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountSnapshotRepo.save).toHaveBeenCalled();
    });

    it('should insert a new snapshot when receiverSignatureRequired changes', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 1, encodedKey: encodedAccountKey, receiverSignatureRequired: true,
      } as any);
      accountSnapshotRepo.save.mockResolvedValue({ id: 12 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountSnapshotRepo.save).toHaveBeenCalled();
    });

    it('should coerce null receiverSignatureRequired to false', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue(
        [makeAccountLink({ receiverSignatureRequired: null })] as any,
      );
      accountSnapshotRepo.findOne.mockResolvedValue({
        id: 77, encodedKey: encodedAccountKey, receiverSignatureRequired: false,
      } as any);

      await service.captureForTransaction(1, executedAt);

      // null coerced to false matches existing false row — should reuse, not insert
      expect(accountSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should stamp createdAt with executedAt on new snapshots', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink()] as any);
      accountSnapshotRepo.findOne.mockResolvedValue(null);
      accountSnapshotRepo.save.mockResolvedValue({ id: 10 } as any);

      const specificDate = new Date('2025-06-15T12:34:56Z');
      await service.captureForTransaction(1, specificDate);

      expect(accountSnapshotRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: specificDate }),
      );
    });

    it('should insert a junction row with transactionId, snapshotId, and isReceiver: false', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink({ isReceiver: false })] as any);
      accountSnapshotRepo.findOne.mockResolvedValue(null);
      accountSnapshotRepo.save.mockResolvedValue({ id: 10 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountJoinChain.values).toHaveBeenCalledWith({
        transaction: { id: 1 },
        accountSnapshot: { id: 10 },
        isReceiver: false,
      });
    });

    it('should insert a junction row with isReceiver: true when the link is a receiver', async () => {
      transactionCachedAccountRepo.find.mockResolvedValue([makeAccountLink({ isReceiver: true })] as any);
      accountSnapshotRepo.findOne.mockResolvedValue({ id: 99, encodedKey: encodedAccountKey, receiverSignatureRequired: false } as any);

      await service.captureForTransaction(1, executedAt);

      expect(accountJoinChain.values).toHaveBeenCalledWith({
        transaction: { id: 1 },
        accountSnapshot: { id: 99 },
        isReceiver: true,
      });
    });
  });

  describe('node snapshot capture', () => {
    beforeEach(() => {
      transactionCachedAccountRepo.find.mockResolvedValue([]);
    });

    it('should skip nodes with null encodedKey', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink({ encodedKey: null })] as any);

      await service.captureForTransaction(1, executedAt);

      expect(nodeSnapshotRepo.findOne).not.toHaveBeenCalled();
      expect(nodeSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should insert a new snapshot when no prior row exists', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue(null);
      nodeSnapshotRepo.save.mockResolvedValue({ id: 200 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(nodeSnapshotRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: 5, mirrorNetwork: 'testnet', encodedKey: encodedNodeKey, createdAt: executedAt }),
      );
    });

    it('should reuse the latest snapshot when the key is unchanged', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue({ id: 55, encodedKey: encodedNodeKey } as any);

      await service.captureForTransaction(1, executedAt);

      expect(nodeSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should query the latest snapshot by nodeId and mirrorNetwork ordered by createdAt DESC', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue(null);
      nodeSnapshotRepo.save.mockResolvedValue({ id: 1 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(nodeSnapshotRepo.findOne).toHaveBeenCalledWith({
        where: { nodeId: 5, mirrorNetwork: 'testnet' },
        order: { createdAt: 'DESC' },
        select: { id: true, encodedKey: true },
      });
    });

    it('should treat an identical encodedKey as unchanged (no insert)', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue({ id: 66, encodedKey: encodedNodeKey } as any);

      await service.captureForTransaction(1, executedAt);

      expect(nodeSnapshotRepo.save).not.toHaveBeenCalled();
    });

    it('should process all nodes in the transaction, not just the first', async () => {
      const key2 = Buffer.from('node-key-2');

      transactionCachedNodeRepo.find.mockResolvedValue([
        makeNodeLink(),
        { transactionId: 1, cachedNode: { nodeId: 7, mirrorNetwork: 'testnet', encodedKey: key2 } },
      ] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue(null);
      nodeSnapshotRepo.save
        .mockResolvedValueOnce({ id: 300 } as any)
        .mockResolvedValueOnce({ id: 301 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(nodeSnapshotRepo.save).toHaveBeenCalledTimes(2);
      expect(nodeSnapshotRepo.save).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 5, encodedKey: encodedNodeKey }));
      expect(nodeSnapshotRepo.save).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 7, encodedKey: key2 }));
    });

    it('should insert a new snapshot when the key changes', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue({ id: 1, encodedKey: Buffer.from('previous-key') } as any);
      nodeSnapshotRepo.save.mockResolvedValue({ id: 201 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(nodeSnapshotRepo.save).toHaveBeenCalled();
    });

    it('should insert a junction row with transactionId and snapshotId', async () => {
      transactionCachedNodeRepo.find.mockResolvedValue([makeNodeLink()] as any);
      nodeSnapshotRepo.findOne.mockResolvedValue(null);
      nodeSnapshotRepo.save.mockResolvedValue({ id: 200 } as any);

      await service.captureForTransaction(1, executedAt);

      expect(nodeJoinChain.values).toHaveBeenCalledWith({
        transaction: { id: 1 },
        nodeSnapshot: { id: 200 },
      });
    });
  });
});
