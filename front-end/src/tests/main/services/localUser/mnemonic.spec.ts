import {
  addMnemonic,
  getMnemonics,
  updateMnemonic,
  removeMnemonics,
} from '@main/services/localUser/mnemonic';

import prisma from '@main/db/__mocks__/prisma';

vi.mock('@main/db/prisma');

describe('Mnemonic Service', () => {
  const now = new Date();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('addMnemonic', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('should add a new mnemonic successfully', async () => {
      const mnemonic = {
        id: 'someId',
        user_id: 'user1',
        mnemonicHash: 'hash',
        nickname: 'nickname',
        created_at: now,
        updated_at: now,
      };

      prisma.mnemonic.count.mockResolvedValue(0);
      prisma.mnemonic.findMany.mockResolvedValue([mnemonic]);
      prisma.mnemonic.create.mockResolvedValue(mnemonic);

      const result = await addMnemonic('user1', 'hash', 'nickname');

      expect(prisma.mnemonic.count).toHaveBeenCalledWith({
        where: { user_id: 'user1', mnemonicHash: 'hash' },
      });
      expect(prisma.mnemonic.create).toHaveBeenCalledWith({
        data: { user_id: 'user1', mnemonicHash: 'hash', nickname: 'nickname' },
      });
      expect(result).toEqual(mnemonic);
    });

    test('should throw an error if the mnemonic already exists', async () => {
      prisma.mnemonic.count.mockResolvedValue(1);

      await expect(addMnemonic('user1', 'hash', 'nickname')).rejects.toThrow(
        'Mnemonic already exists!',
      );
    });
  });

  describe('getMnemonics', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('should retrieve mnemonics successfully', async () => {
      const mnemonics = [
        {
          id: 'someId',
          user_id: 'user1',
          mnemonicHash: 'hash',
          nickname: 'nickname',
          created_at: now,
          updated_at: now,
        },
      ];
      prisma.mnemonic.findMany.mockResolvedValue(mnemonics);

      const result = await getMnemonics({ where: { user_id: 'user1' } });

      expect(prisma.mnemonic.findMany).toHaveBeenCalledWith({ where: { user_id: 'user1' } });
      expect(result).toEqual(mnemonics);
    });

    test('should handle errors during retrieval', async () => {
      prisma.mnemonic.findMany.mockRejectedValueOnce('Database error');

      const result = await getMnemonics({ where: { user_id: 'user1' } });

      expect(prisma.mnemonic.findMany).toHaveBeenCalledWith({ where: { user_id: 'user1' } });
      expect(result).toEqual([]);
    });
  });

  describe('updateMnemonic', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('should update an existing mnemonic successfully', async () => {
      const mnemonic = {
        id: 'someId',
        user_id: 'user1',
        mnemonicHash: 'hash',
        nickname: 'nickname',
        created_at: now,
        updated_at: now,
      };
      prisma.mnemonic.findFirst.mockResolvedValue(mnemonic);
      prisma.mnemonic.findMany.mockResolvedValue([mnemonic]);

      await updateMnemonic('user1', 'hash', 'newNickname');

      expect(prisma.mnemonic.findFirst).toHaveBeenCalledWith({
        where: { user_id: 'user1', mnemonicHash: 'hash' },
      });
      expect(prisma.mnemonic.update).toHaveBeenCalledWith({
        where: { id: mnemonic.id },
        data: { nickname: 'newNickname' },
      });
    });

    test('should throw an error if the mnemonic does not exist', async () => {
      prisma.mnemonic.findFirst.mockResolvedValue(null);

      await expect(updateMnemonic('user1', 'hash', 'newNickname')).rejects.toThrow(
        'Mnemonic does not exist!',
      );
    });
  });

  describe('removeMnemonics', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('should remove mnemonics successfully', async () => {
      await removeMnemonics('user1', ['hash']);

      expect(prisma.mnemonic.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 'user1', mnemonicHash: { in: ['hash'] } },
      });
    });

    test('should handle errors during removal', async () => {
      prisma.mnemonic.deleteMany.mockRejectedValue(new Error('Database error'));

      await expect(removeMnemonics('user1', ['hash'])).rejects.toThrow('Database error');
    });
  });
});
