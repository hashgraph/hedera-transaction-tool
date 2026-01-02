import { DataSource } from 'typeorm';
import { CacheHelper } from './cache.helper';
import { PublicKey } from '@hashgraph/sdk';

describe('CacheHelper', () => {
  let helper: CacheHelper;
  let dataSource: jest.Mocked<DataSource>;
  let qb: any;

  beforeEach(() => {
    qb = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    dataSource = {
      createQueryBuilder: jest.fn(() => qb),
      manager: {
        findOne: jest.fn(),
      },
    } as any;

    helper = new CacheHelper(dataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('tryClaimRefresh', () => {
    const entity = {} as any;
    const where = { id: 1 };

    it('returns updated row when claim succeeds', async () => {
      qb.execute
        .mockResolvedValueOnce({ raw: [] }) // insert
        .mockResolvedValueOnce({ affected: 1, raw: [{ id: 1 }] }); // update

      const result = await helper.tryClaimRefresh(entity, where, 1000);

      expect(result).toEqual({ id: 1 });
    });

    it('returns inserted row when update fails but insert happened', async () => {
      qb.execute
        .mockResolvedValueOnce({ raw: [{ id: 2 }] }) // insert
        .mockResolvedValueOnce({ affected: 0, raw: [] }); // update

      const result = await helper.tryClaimRefresh(entity, where, 1000);

      expect(result).toEqual({ id: 2 });
    });

    it('falls back to findOne when neither update nor insert wins', async () => {
      qb.execute
        .mockResolvedValueOnce({ raw: [] }) // insert
        .mockResolvedValueOnce({ affected: 0, raw: [] }); // update

      (dataSource.manager.findOne as jest.Mock).mockResolvedValue({ id: 3 });

      const result = await helper.tryClaimRefresh(entity, where, 1000);

      expect(dataSource.manager.findOne).toHaveBeenCalledWith(entity, { where });
      expect(result).toEqual({ id: 3 });
    });
  });

  describe('saveAndReleaseClaim', () => {
    const entity = {} as any;

    it('returns id when claim is successfully released', async () => {
      qb.execute.mockResolvedValue({
        affected: 1,
        raw: [{ id: 10 }],
      });

      const result = await helper.saveAndReleaseClaim(
        entity,
        { id: 10 },
        'token',
        { foo: 'bar' },
      );

      expect(result).toBe(10);
    });

    it('returns null when claim is lost', async () => {
      qb.execute.mockResolvedValue({
        affected: 0,
        raw: [],
      });

      const result = await helper.saveAndReleaseClaim(
        entity,
        { id: 10 },
        'token',
        { foo: 'bar' },
      );

      expect(result).toBeNull();
    });
  });

  describe('insertKeys', () => {
    const keyEntity = {} as any;

    it('does nothing when keys array is empty', async () => {
      await helper.insertKeys(keyEntity, 1, 'account', []);

      expect(dataSource.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('inserts keys when provided', async () => {
      const key = {
        toStringRaw: jest.fn(() => 'raw-key'),
      } as unknown as PublicKey;

      qb.execute.mockResolvedValue({});

      await helper.insertKeys(keyEntity, 1, 'account', [key]);

      expect(qb.values).toHaveBeenCalledWith([
        {
          account: { id: 1 },
          publicKey: 'raw-key',
        },
      ]);
    });
  });

  describe('linkTransactionToEntity', () => {
    it('links transaction to entity idempotently', async () => {
      qb.execute.mockResolvedValue({});

      await helper.linkTransactionToEntity(
        {} as any,
        5,
        9,
        'node',
      );

      expect(qb.values).toHaveBeenCalledWith({
        transaction: { id: 5 },
        node: { id: 9 },
      });
    });
  });
});