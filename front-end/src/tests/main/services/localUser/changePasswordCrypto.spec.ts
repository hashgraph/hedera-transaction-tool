import { describe, expect, test, vi } from 'vitest';

import type { KeyPair, OrganizationCredentials } from '@prisma/client';

import prisma from '@main/db/__mocks__/prisma';

import { changePassword } from '@main/services/localUser/auth';
import { decrypt, encrypt, hash, verifyHash } from '@main/utils/crypto';

// Real crypto (PBKDF2 / argon2) on purpose: only the database and the platform are mocked, to
// prove that what changePassword writes really opens with the new password and only with it.

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@main/modules/logger', () => ({
  default: vi.fn(),
  createLogger: () => loggerMock,
  getAppUpdateLogger: () => loggerMock,
  getDatabaseLogger: () => loggerMock,
  getLogsDirectoryPath: () => '/tmp/test-logs',
  getLogFilePath: () => '/tmp/test-logs/app.log',
  getLoggerSettings: () => ({}),
  logRendererMessage: vi.fn(),
}));
vi.mock('@main/db/prisma');
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  session: { fromPartition: vi.fn() },
  safeStorage: { encryptString: vi.fn(), decryptString: vi.fn() },
}));
vi.mock('@main/services/organization/auth', () => ({ login: vi.fn() }));
vi.mock('@main/services/localUser/claim', () => ({ getUseKeychainClaim: vi.fn() }));

describe('changePassword with real encryption', { timeout: 60_000 }, () => {
  const userId = 'user-1';
  const oldPassword = 'old-password-123';
  const newPassword = 'new-password-456';
  const clearJwt = 'aaa.bbb.ccc';

  const setup = async (options?: { wrongPasswordKeyIndex?: number }) => {
    const plainKeys = Array.from({ length: 6 }, (_, i) => `private-key-${i}`);
    const keyPairs = await Promise.all(
      plainKeys.map(async (plain, i) => ({
        id: `key${i}`,
        user_id: userId,
        public_key: `public${i}`,
        private_key: await encrypt(
          plain,
          i === options?.wrongPasswordKeyIndex ? 'some-other-password' : oldPassword,
        ),
      })),
    );
    const credentials = [
      {
        id: 'cred0',
        user_id: userId,
        password: await encrypt('org-password-0', oldPassword),
        jwtToken: await encrypt('jwt-0', oldPassword),
      },
      // Signed out of this organization: nothing stored
      { id: 'cred1', user_id: userId, password: '', jwtToken: null },
      // Token not encrypted yet
      {
        id: 'cred2',
        user_id: userId,
        password: await encrypt('org-password-2', oldPassword),
        jwtToken: clearJwt,
      },
    ];

    prisma.user.findFirst.mockResolvedValue({
      id: userId,
      email: 'user@test.com',
      password: await hash(oldPassword),
    } as never);
    prisma.keyPair.findMany.mockResolvedValue(keyPairs as KeyPair[]);
    prisma.organizationCredentials.findMany.mockResolvedValue(
      credentials as OrganizationCredentials[],
    );

    return { plainKeys };
  };

  test('re-encrypts every key and credential so they open only with the new password', async () => {
    const { plainKeys } = await setup();

    await changePassword(userId, oldPassword, newPassword);

    // New login hash
    const userUpdate = prisma.user.update.mock.calls[0][0];
    expect(await verifyHash(userUpdate.data.password as string, newPassword)).toBe(true);
    expect(await verifyHash(userUpdate.data.password as string, oldPassword)).toBe(false);

    // Every key
    expect(prisma.keyPair.update).toHaveBeenCalledTimes(plainKeys.length);
    for (const [args] of prisma.keyPair.update.mock.calls) {
      const index = Number(String(args.where.id).replace('key', ''));
      const stored = args.data.private_key as string;
      expect(await decrypt(stored, newPassword)).toBe(plainKeys[index]);
      await expect(decrypt(stored, oldPassword)).rejects.toThrow();
    }

    // Credentials: only the ones that hold encrypted data are rewritten
    const credUpdates = new Map(
      prisma.organizationCredentials.update.mock.calls.map(([args]) => [args.where.id, args.data]),
    );
    expect([...credUpdates.keys()].sort()).toEqual(['cred0', 'cred2']);

    const cred0 = credUpdates.get('cred0')!;
    expect(await decrypt(cred0.password as string, newPassword)).toBe('org-password-0');
    expect(await decrypt(cred0.jwtToken as string, newPassword)).toBe('jwt-0');
    await expect(decrypt(cred0.password as string, oldPassword)).rejects.toThrow();

    const cred2 = credUpdates.get('cred2')!;
    expect(await decrypt(cred2.password as string, newPassword)).toBe('org-password-2');
    expect(cred2.jwtToken).toBeUndefined(); // clear text token is left as is

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test('writes nothing if a single key cannot be decrypted', async () => {
    await setup({ wrongPasswordKeyIndex: 4 });

    await expect(changePassword(userId, oldPassword, newPassword)).rejects.toThrow();

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
