import { addClaim, getClaims, updateClaim, removeClaims } from '@main/services/localUser/claim';

import prisma from '@main/db/__mocks__/prisma';

vi.mock('@main/db/prisma');

describe('Claim Service', () => {
  const now = new Date();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('addClaim', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should add a new claim successfully', async () => {
      const claim = {
        id: 'someId',
        user_id: 'user1',
        claim_key: 'key1',
        claim_value: 'value1',
        created_at: now,
        updated_at: now,
      };

      prisma.claim.count.mockResolvedValue(0);
      prisma.claim.findMany.mockResolvedValue([claim]);
      prisma.claim.create.mockResolvedValue(claim);

      const result = await addClaim('user1', 'key1', 'value1');

      expect(prisma.claim.count).toHaveBeenCalledWith({
        where: { user_id: 'user1', claim_key: 'key1' },
      });
      expect(prisma.claim.create).toHaveBeenCalledWith({
        data: { user_id: 'user1', claim_key: 'key1', claim_value: 'value1' },
      });
      expect(result).toEqual(claim);
    });

    it('should throw an error if the claim already exists', async () => {
      prisma.claim.count.mockResolvedValue(1);

      await expect(addClaim('user1', 'key1', 'value1')).rejects.toThrow('Claim already exists!');
    });
  });

  describe('getClaims', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should retrieve claims successfully', async () => {
      const claims = [
        {
          id: 'someId',
          user_id: 'user1',
          claim_key: 'key1',
          claim_value: 'value1',
          created_at: now,
          updated_at: now,
        },
      ];
      prisma.claim.findMany.mockResolvedValue(claims);

      const result = await getClaims({ where: { user_id: 'user1' } });

      expect(prisma.claim.findMany).toHaveBeenCalledWith({ where: { user_id: 'user1' } });
      expect(result).toEqual(claims);
    });

    it('should handle errors during retrieval', async () => {
      prisma.claim.findMany.mockRejectedValueOnce('Database error');

      const result = await getClaims({ where: { user_id: 'user1' } });

      expect(prisma.claim.findMany).toHaveBeenCalledWith({ where: { user_id: 'user1' } });
      expect(result).toEqual([]);
    });
  });

  describe('updateClaim', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should update an existing claim successfully', async () => {
      const claim = {
        id: 'someId',
        user_id: 'user1',
        claim_key: 'key1',
        claim_value: 'oldValue',
        created_at: now,
        updated_at: now,
      };
      prisma.claim.findFirst.mockResolvedValue(claim);
      prisma.claim.findMany.mockResolvedValue([claim]);

      await updateClaim('user1', 'key1', 'newValue');

      expect(prisma.claim.findFirst).toHaveBeenCalledWith({
        where: { user_id: 'user1', claim_key: 'key1' },
      });
      expect(prisma.claim.update).toHaveBeenCalledWith({
        where: { id: claim.id },
        data: { claim_value: 'newValue' },
      });
    });

    it('should throw an error if the claim does not exist', async () => {
      prisma.claim.findFirst.mockResolvedValue(null);

      await expect(updateClaim('user1', 'key1', 'newValue')).rejects.toThrow(
        'Claim does not exist!',
      );
    });
  });

  describe('removeClaims', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should remove claims successfully', async () => {
      prisma.claim.findMany.mockResolvedValue([
        {
          id: 'someId',
          user_id: 'user1',
          claim_key: 'key1',
          claim_value: 'oldValue',
          created_at: now,
          updated_at: now,
        },
      ]);

      await removeClaims('user1', ['key1']);

      expect(prisma.claim.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 'user1', claim_key: { in: ['key1'] } },
      });
    });

    it('should handle errors during removal', async () => {
      prisma.claim.deleteMany.mockRejectedValue(new Error('Database error'));

      await expect(removeClaims('user1', ['key1'])).rejects.toThrow('Database error');
    });
  });
});
