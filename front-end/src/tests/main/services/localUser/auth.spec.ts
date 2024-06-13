import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import * as auth from '@main/services/localUser/auth';

import { randomUUID } from 'crypto';
import { hash } from '@main/utils/crypto';
import { changeDecryptionPassword } from '@main/services/localUser/keyPairs';

vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');
vi.mock('@main/utils/crypto', () => ({ hash: vi.fn() }));
vi.mock('@main/services/localUser/keyPairs', () => ({ changeDecryptionPassword: vi.fn() }));

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
      const uuid = `1234-1234-1234-1234-1234`;
      const hashed = Buffer.from('hashed-password');

      vi.mocked(randomUUID).mockReturnValue(uuid);
      vi.mocked(hash).mockReturnValue(hashed);

      await auth.register(email, password);

      expect(randomUUID).toHaveBeenCalledTimes(1);
      expect(hash).toHaveBeenCalledWith(password);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          id: uuid,
          email: email,
          password: hashed.toString('hex'),
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
      const uuid = `1234-1234-1234-1234-1234`;
      const hashed = Buffer.from('hashed-password');

      vi.mocked(randomUUID).mockReturnValue(uuid);
      vi.mocked(hash).mockReturnValue(hashed);

      await auth.register(email, password);

      expect(randomUUID).toHaveBeenCalledTimes(1);
      expect(hash).toHaveBeenCalledWith(password);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          id: uuid,
          email: email,
          password: hashed.toString('hex'),
        },
      });
    });

    test('Should throw an error if no user is registered', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(auth.login('email', 'password')).rejects.toThrow('Please register');
    });

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
      vi.mocked(hash).mockReturnValue(Buffer.from(incorrectPassword, 'hex'));

      await expect(auth.login(user.email, incorrectPassword)).rejects.toThrow('Incorrect password');
    });

    test('Should return the user if the email and password are correct', async () => {
      prisma.user.findFirst.mockResolvedValue(user);
      vi.mocked(hash).mockReturnValue(Buffer.from(user.password, 'hex'));

      const result = await auth.login(user.email, user.password);

      expect(result).toStrictEqual(user);
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

      vi.mocked(hash).mockReturnValue(Buffer.from(user.password, 'hex'));

      const result = await auth.comparePasswords(user.id, user.password);

      expect(result).toBe(true);
    });

    test('Should return false if the password is incorrect', async () => {
      const incorrectPassword = 'incorrect_password';
      prisma.user.findFirst.mockResolvedValue(user);

      vi.mocked(hash).mockReturnValue(Buffer.from(incorrectPassword, 'hex'));

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

      vi.mocked(hash).mockReturnValue(Buffer.from(oldPassword));

      await expect(auth.changePassword(userId, oldPassword, newPassword)).rejects.toThrow(
        'Incorrect current password',
      );
    });

    test('Should update the user password and change the decryption password if the old password is correct', async () => {
      const userId = '123';
      const newPassword = 'newPassword';

      vi.mocked(hash).mockReturnValue(Buffer.from(userPassword));

      await auth.changePassword(userId, userPassword, newPassword);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: {
          id: userId,
        },
        data: {
          password: hash(newPassword).toString('hex'),
        },
      });
      expect(changeDecryptionPassword).toHaveBeenCalledWith(userId, userPassword, newPassword);
    });
  });
});
