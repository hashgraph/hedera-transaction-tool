import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import { randomUUID } from 'crypto';

import * as auth from '@main/services/localUser/auth';
import { changeDecryptionPassword } from '@main/services/localUser/keyPairs';
import { dualCompareHash, hash } from '@main/utils/crypto';

vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');
vi.mock('@main/utils/crypto');
vi.mock('@main/services/localUser/keyPairs');

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

    test('Should update the user password and change the decryption password if the old password is correct', async () => {
      const userId = '123';
      const newPassword = 'newPassword';

      vi.mocked(hash).mockResolvedValueOnce(userPassword);
      vi.mocked(dualCompareHash).mockResolvedValueOnce({ correct: true, isBcrypt: false });

      await auth.changePassword(userId, userPassword, newPassword);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: {
          id: userId,
        },
        data: {
          password: userPassword,
        },
      });
      expect(changeDecryptionPassword).toHaveBeenCalledWith(userId, userPassword, newPassword);
    });
  });
});
