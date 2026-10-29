import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import { randomUUID } from 'crypto';

import * as auth from '@main/services/localUser/auth';
import { prepareKeyPairsReencryption } from '@main/services/localUser/keyPairs';
import { prepareCredentialsReencryption } from '@main/services/localUser/organizationCredentials';
import { dualCompareHash, hash } from '@main/utils/crypto';

vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');
vi.mock('@main/utils/crypto');
vi.mock('@main/services/localUser/keyPairs');
vi.mock('@main/services/localUser/organizationCredentials');

describe('Services Local User Auth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('register', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should register user with email and password', async () => {
      const email = 'test@email.com';
      const password = 'password';
      const uuid = '1234-1234-1234-1234-1234';
      const hashed = 'hashed-password';

      vi.mocked(randomUUID).mockReturnValue(uuid);
      vi.mocked(hash).mockResolvedValueOnce(hashed);

      await auth.register(email, password);

      expect(randomUUID).toHaveBeenCalledTimes(1);
      expect(hash).toHaveBeenCalledWith(password);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          id: uuid,
          email: email,
          password: hashed,
        },
      });
    });
  });

  describe('login', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should register user with email and password', async () => {
      const email = 'test@email.com';
      const password = 'password';
      const uuid = '1234-1234-1234-1234-1234';
      const hashed = 'hashed-password';

      vi.mocked(randomUUID).mockReturnValue(uuid);
      vi.mocked(hash).mockResolvedValueOnce(hashed);

      await auth.register(email, password);

      expect(randomUUID).toHaveBeenCalledTimes(1);
      expect(hash).toHaveBeenCalledWith(password);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          id: uuid,
          email: email,
          password: hashed,
        },
      });
    });

    // test('Should throw an error if no user is registered', async () => {
    //   prisma.user.findFirst.mockResolvedValue(null);

    //   await expect(auth.login('email', 'password')).rejects.toThrow('Please register');
    // });

    const user = {
      id: '123',
      email: 'email',
      password: Buffer.from('password').toString('hex'),
      created_at: new Date(),
      updated_at: new Date(),
    };

    test('Should throw an error if the email is incorrect', async () => {
      const incorrectEmail = 'incorrect_email';
      prisma.user.findFirst.mockResolvedValue(user);

      await expect(auth.login(incorrectEmail, user.password)).rejects.toThrow('Incorrect email');
    });

    test('Should throw an error if the password is incorrect', async () => {
      const incorrectPassword = 'incorrect_password';

      prisma.user.findFirst.mockResolvedValue(user);
      vi.mocked(hash).mockResolvedValueOnce(incorrectPassword);
      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: false, isBcrypt: false });

      await expect(auth.login(user.email, incorrectPassword)).rejects.toThrow('Incorrect password');
    });

    test('Should return the user if the email and password are correct', async () => {
      prisma.user.findFirst.mockResolvedValue(user);
      vi.mocked(hash).mockResolvedValueOnce(user.password);
      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: true, isBcrypt: false });

      const result = await auth.login(user.email, user.password);

      expect(result).toStrictEqual(user);
    });

    test('Should update the password if the password is encrypted with bcrypt', async () => {
      prisma.user.findFirst.mockResolvedValue(user);
      vi.mocked(hash).mockResolvedValueOnce(user.password);
      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: true, isBcrypt: true });

      await auth.login(user.email, user.password);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: {
          id: user.id,
        },
        data: {
          password: user.password,
        },
      });
    });
  });

  describe('deleteUser', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete the user with the given email', async () => {
      const email = 'test@example.com';

      await auth.deleteUser(email);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: {
          email,
        },
      });
    });
  });

  describe('getUsersCount', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return the count of users', async () => {
      prisma.user.count.mockResolvedValue(5);

      const result = await auth.getUsersCount();

      expect(result).toBe(5);
    });
  });

  describe('comparePasswords', () => {
    const user = {
      id: '123',
      email: 'email',
      password: Buffer.from('password').toString('hex'),
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should throw an error if the user is not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(auth.comparePasswords(user.id, user.password)).rejects.toThrow('User not found');
    });

    test('Should return true if the password is correct', async () => {
      prisma.user.findFirst.mockResolvedValue(user);

      vi.mocked(hash).mockResolvedValueOnce(user.password);
      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: true, isBcrypt: false });
      const result = await auth.comparePasswords(user.id, user.password);

      expect(result).toBe(true);
    });

    test('Should return false if the password is incorrect', async () => {
      const incorrectPassword = 'incorrect_password';
      prisma.user.findFirst.mockResolvedValue(user);

      vi.mocked(hash).mockResolvedValueOnce(incorrectPassword);
      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: false, isBcrypt: false });

      const result = await auth.comparePasswords(user.id, incorrectPassword);

      expect(result).toBe(false);
    });
  });

  describe('changePassword', () => {
    const userPassword = 'password';
    const user = {
      id: '123',
      email: 'email',
      password: Buffer.from(userPassword).toString('hex'),
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      vi.resetAllMocks();
      prisma.user.findFirst.mockResolvedValue(user);
    });

    test('Should throw an error if the old password is incorrect', async () => {
      const userId = '123';
      const oldPassword = 'oldPassword';
      const newPassword = 'newPassword';

      vi.mocked(hash).mockResolvedValueOnce(oldPassword);
      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: false, isBcrypt: false });

      await expect(auth.changePassword(userId, oldPassword, newPassword)).rejects.toThrow(
        'Incorrect current password',
      );
    });

    test('Should write the hash and all re-encrypted data in one transaction', async () => {
      const userId = '123';
      const newPassword = 'newPassword';
      const keyUpdates = [
        { where: { id: 'k1' }, data: { private_key: 'enc1' } },
        { where: { id: 'k2' }, data: { private_key: 'enc2' } },
        { where: { id: 'k3' }, data: { private_key: 'enc3' } },
      ];
      const credUpdates = [
        { where: { id: 'c1' }, data: { password: 'enc1', jwtToken: 'jwt1' } },
        { where: { id: 'c2' }, data: { password: 'enc2' } },
      ];

      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: true, isBcrypt: false });
      vi.mocked(hash).mockResolvedValueOnce('new-hash');
      vi.mocked(prepareKeyPairsReencryption).mockResolvedValueOnce(keyUpdates);
      vi.mocked(prepareCredentialsReencryption).mockResolvedValueOnce(credUpdates);
      prisma.user.update.mockReturnValue('user-op' as never);
      prisma.keyPair.update.mockImplementation(((args: { where: { id: string } }) =>
        `key-op:${args.where.id}`) as never);
      prisma.organizationCredentials.update.mockImplementation(((args: {
        where: { id: string };
      }) => `cred-op:${args.where.id}`) as never);

      await auth.changePassword(userId, userPassword, newPassword);

      expect(prepareKeyPairsReencryption).toHaveBeenCalledWith(userId, userPassword, newPassword);
      expect(prepareCredentialsReencryption).toHaveBeenCalledWith(
        userId,
        userPassword,
        newPassword,
      );
      expect(hash).toHaveBeenCalledWith(newPassword);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { password: 'new-hash' },
      });
      keyUpdates.forEach(update => expect(prisma.keyPair.update).toHaveBeenCalledWith(update));
      credUpdates.forEach(update =>
        expect(prisma.organizationCredentials.update).toHaveBeenCalledWith(update),
      );
      // The hash, every key and every credential are committed together
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledWith([
        'user-op',
        'key-op:k1',
        'key-op:k2',
        'key-op:k3',
        'cred-op:c1',
        'cred-op:c2',
      ]);
    });

    test('Should not change the password hash if a key cannot be re-encrypted', async () => {
      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: true, isBcrypt: false });
      vi.mocked(prepareKeyPairsReencryption).mockRejectedValueOnce(new Error('bad decrypt'));

      await expect(auth.changePassword('123', userPassword, 'newPassword')).rejects.toThrow(
        'bad decrypt',
      );

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test('Should not change the password hash if credentials cannot be re-encrypted', async () => {
      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: true, isBcrypt: false });
      vi.mocked(prepareKeyPairsReencryption).mockResolvedValueOnce([]);
      vi.mocked(prepareCredentialsReencryption).mockRejectedValueOnce(new Error('db error'));

      await expect(auth.changePassword('123', userPassword, 'newPassword')).rejects.toThrow(
        'db error',
      );

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test('Should not re-encrypt anything if the old password is incorrect', async () => {
      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: false, isBcrypt: false });

      await expect(auth.changePassword('123', 'wrong', 'newPassword')).rejects.toThrow(
        'Incorrect current password',
      );

      expect(prepareKeyPairsReencryption).not.toHaveBeenCalled();
      expect(prepareCredentialsReencryption).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
