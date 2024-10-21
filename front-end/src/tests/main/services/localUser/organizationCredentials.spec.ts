import { expect, vi } from 'vitest';

import { Organization, OrganizationCredentials } from '@prisma/client';

import prisma from '@main/db/__mocks__/prisma';

import {
  addOrganizationCredentials,
  deleteOrganizationCredentials,
  getAccessToken,
  getOrganizationTokens,
  getCurrentUser,
  getOrganizationCredentials,
  organizationCredentialsExists,
  organizationsToSignIn,
  shouldSignInOrganization,
  tryAutoSignIn,
  updateOrganizationCredentials,
} from '@main/services/localUser/organizationCredentials';

import { safeStorage, session } from 'electron';
import { jwtDecode } from 'jwt-decode';
import { decrypt, encrypt } from '@main/utils/crypto';
import { login } from '@main/services/organization';
import { getUseKeychainClaim } from '@main/services/localUser/claim';

vi.mock('@main/db/prisma');
vi.mock('electron', () => ({
  session: { fromPartition: vi.fn() },
  safeStorage: { encryptString: vi.fn(), decryptString: vi.fn() },
}));
vi.mock('jwt-decode', () => ({ jwtDecode: vi.fn() }));
vi.mock('@main/utils/crypto');
vi.mock('@main/services/organization/auth', () => ({ login: vi.fn() }));
vi.mock('@main/services/localUser/claim', () => ({ getUseKeychainClaim: vi.fn() }));

describe('Services Local User Organization Credentials', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const organizationCredentials: OrganizationCredentials = {
    id: '1',
    user_id: '123',
    organization_id: '321',
    organization_user_id: 1,
    email: 'email',
    password: 'encryptedPassword',
    updated_at: new Date(),
    jwtToken: null,
  };

  const organization: Organization = {
    id: '321',
    nickname: 'organization',
    serverUrl: 'http://localhost:3000',
    key: 'key',
  };

  describe('getOrganizationTokens', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return the organizations that the user is connected to', async () => {
      const records = [
        {
          organizationId: organization,
          jwtToken: 'token',
        },
      ] as unknown as OrganizationCredentials[];

      prisma.organizationCredentials.findMany.mockResolvedValue(records);

      const result = await getOrganizationTokens('123');

      expect(result).toEqual([organization]);
    });

    test('Should return empty array if organizations are null', async () => {
      prisma.organizationCredentials.findMany.mockResolvedValue(
        null as unknown as OrganizationCredentials[],
      );

      const result = await getOrganizationTokens('123');

      expect(result).toEqual([]);
    });

    test('Should return empty array on prisma error', async () => {
      prisma.organizationCredentials.findMany.mockRejectedValue('Database error');

      const result = await getOrganizationTokens('123');

      expect(result).toEqual([]);
    });
  });

  describe('organizationsToSignIn', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    const urlHost = 'localhost';
    const serverUrl = `http://${urlHost}:3000`;
    const credentials = [
      {
        ...organizationCredentials,
        organization: {
          serverUrl,
        },
      },
    ];

    test('Should add organization to the result if there is no password', async () => {
      const credentials = [{ ...organizationCredentials, password: '' }];

      prisma.organizationCredentials.findMany.mockResolvedValue(credentials);

      const result = await organizationsToSignIn('123');

      expect(result).toEqual(credentials);
    });

    test('Should add organization to the result if there is no access token', async () => {
      const ses = {
        cookies: {
          get: vi.fn().mockResolvedValue([]),
        },
      } as unknown as Electron.Session;
      vi.mocked(session.fromPartition).mockReturnValue(ses);

      prisma.organizationCredentials.findMany.mockResolvedValue(credentials);

      const result = await organizationsToSignIn('123');

      expect(result).toEqual(credentials);
    });

    test('Should add organization to the result if there invalid token', async () => {
      const ses = {
        cookies: {
          get: vi.fn().mockResolvedValue([{ domain: urlHost, value: 'invalidToken' }]),
        },
      } as unknown as Electron.Session;
      vi.mocked(jwtDecode).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      vi.mocked(session.fromPartition).mockReturnValue(ses);

      prisma.organizationCredentials.findMany.mockResolvedValue(credentials);

      const result = await organizationsToSignIn('123');

      expect(result).toEqual(credentials);
    });

    test('Should add organization to the result if there is token but is expired', async () => {
      const ses = {
        cookies: {
          get: vi.fn().mockResolvedValue([
            {
              domain: urlHost,
              value: 'expired token',
            },
          ]),
        },
      } as unknown as Electron.Session;
      vi.mocked(session.fromPartition).mockReturnValue(ses);
      vi.mocked(jwtDecode).mockReturnValue({ exp: 1 });

      prisma.organizationCredentials.findMany.mockResolvedValue(credentials);

      const result = await organizationsToSignIn('123');

      expect(result).toEqual(credentials);
    });

    test('Should add organization to the result if there is a valid token', async () => {
      const ses = {
        cookies: {
          get: vi.fn().mockResolvedValue([
            {
              domain: urlHost,
              value: 'valid token',
            },
          ]),
        },
      } as unknown as Electron.Session;
      vi.mocked(session.fromPartition).mockReturnValue(ses);
      vi.mocked(jwtDecode).mockReturnValue({ exp: Date.now() + 2 * 1000 });

      prisma.organizationCredentials.findMany.mockResolvedValue(credentials);

      const result = await organizationsToSignIn('123');

      expect(result).toEqual([]);
    });

    test('Should return empty array if there is database error', async () => {
      prisma.organizationCredentials.findMany.mockRejectedValue('Database error');

      const result = await organizationsToSignIn('123');

      expect(result).toEqual([]);
    });
  });

  describe('shouldSignInOrganization', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return true if the credentials are invalid', async () => {
      const credentials = { ...organizationCredentials, password: '' };

      prisma.organizationCredentials.findFirst.mockResolvedValue(credentials);

      const result = await shouldSignInOrganization('123', '321');

      expect(result).toEqual(true);
    });

    test('Should return true if there is a database error', async () => {
      prisma.organizationCredentials.findFirst.mockRejectedValue('Database error');

      const result = await shouldSignInOrganization('123', '321');

      expect(result).toEqual(true);
    });

    test('Should return false if there is no credentials', async () => {
      prisma.organizationCredentials.findFirst.mockResolvedValue(null);

      const result = await shouldSignInOrganization('123', '321');

      expect(result).toEqual(true);
    });
  });

  describe('getAccessToken', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return token for the required domain', async () => {
      const urlHost = 'localhost';
      const serverUrl = `http://${urlHost}:3000`;
      const tokenValue = 'token';

      const ses = {
        cookies: {
          get: vi.fn().mockResolvedValue([{ domain: urlHost, value: tokenValue }]),
        },
      } as unknown as Electron.Session;
      vi.mocked(session.fromPartition).mockReturnValue(ses);

      const result = await getAccessToken(serverUrl);

      expect(result).toEqual(tokenValue);
    });

    test('Should return null if error occurs', async () => {
      const result = await getAccessToken('some-server');

      expect(result).toEqual(null);
    });
  });

  describe('getCurrentUser', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return token payload if there is token', async () => {
      const urlHost = 'localhost';
      const serverUrl = `http://${urlHost}:3000`;
      const payload = { token: 'payload' };

      const ses = {
        cookies: {
          get: vi.fn().mockResolvedValue([
            {
              domain: urlHost,
              value: 'some valid token',
            },
          ]),
        },
      } as unknown as Electron.Session;
      vi.mocked(session.fromPartition).mockReturnValue(ses);
      vi.mocked(jwtDecode).mockReturnValue(payload);

      const result = await getCurrentUser(serverUrl);

      expect(result).toEqual(payload);
    });

    test('Should return null if there is not token', async () => {
      const urlHost = 'localhost';
      const serverUrl = `http://${urlHost}:3000`;

      const ses = {
        cookies: {
          get: vi.fn().mockResolvedValue([]),
        },
      } as unknown as Electron.Session;
      vi.mocked(session.fromPartition).mockReturnValue(ses);

      const result = await getCurrentUser(serverUrl);

      expect(result).toEqual(null);
    });

    test('Should return null if an error occur', async () => {
      const urlHost = 'localhost';
      const serverUrl = `http://${urlHost}:3000`;

      const ses = {
        cookies: {
          get: vi.fn().mockResolvedValue([
            {
              domain: urlHost,
              value: 'invlaid',
            },
          ]),
        },
      } as unknown as Electron.Session;
      vi.mocked(session.fromPartition).mockReturnValue(ses);
      vi.mocked(jwtDecode).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await getCurrentUser(serverUrl);

      expect(result).toEqual(null);
    });
  });

  describe('getOrganizationCredentials', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return organization credentials', async () => {
      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      await getOrganizationCredentials('123', '321');

      expect(prisma.organizationCredentials.findFirst).toHaveBeenCalledWith({
        where: { user_id: '321', organization_id: '123' },
      });
    });

    test('Should return null if database error occur', async () => {
      prisma.organizationCredentials.findFirst.mockRejectedValue('Database error');

      const result = await getOrganizationCredentials('123', '321');

      expect(result).toEqual(null);
    });
  });

  describe('organizationCredentialsExists', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return true if organization credentials exists', async () => {
      prisma.organizationCredentials.count.mockResolvedValue(1);

      const exists = await organizationCredentialsExists('123', '321');

      expect(exists).toEqual(true);
      expect(prisma.organizationCredentials.count).toHaveBeenCalledWith({
        where: { user_id: '321', organization_id: '123' },
      });
    });

    test('Should return false if organization credentials does not exists', async () => {
      prisma.organizationCredentials.count.mockResolvedValue(0);

      const exists = await organizationCredentialsExists('123', '321');

      expect(exists).toEqual(false);
      expect(prisma.organizationCredentials.count).toHaveBeenCalledWith({
        where: { user_id: '321', organization_id: '123' },
      });
    });

    test('Should return false if database error occur', async () => {
      prisma.organizationCredentials.count.mockRejectedValue('Database error');

      const result = await organizationCredentialsExists('123', '321');

      expect(result).toEqual(false);
    });
  });

  describe('updateOrganizationCredentials', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should update organization credentials with encryption without keychain', async () => {
      const email = 'email';
      const password = 'password';
      const encryptPassword = 'password for encryption';
      const encryptedPassword = `the encrption of password with encryptPassword`;

      vi.mocked(encrypt).mockReturnValue(encryptedPassword);
      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      await updateOrganizationCredentials('123', '321', email, password, encryptPassword);

      expect(prisma.organizationCredentials.update).toHaveBeenCalledWith({
        where: { id: organizationCredentials.id },
        data: { email, password: encryptedPassword },
      });
    });

    test('Should update organization credentials with encryption with keychain', async () => {
      const email = 'email';
      const password = 'password';
      const encryptedPassword = Buffer.from('the encrption of password with encryptPassword');

      vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(true);
      vi.mocked(safeStorage.encryptString).mockReturnValue(encryptedPassword);
      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      await updateOrganizationCredentials('123', '321', email, password, undefined, null);

      expect(prisma.organizationCredentials.update).toHaveBeenCalledWith({
        where: { id: organizationCredentials.id },
        data: { email, password: encryptedPassword.toString('base64') },
      });
    });

    test('Should update only email', async () => {
      const email = 'email';

      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      await updateOrganizationCredentials('123', '321', email);

      expect(prisma.organizationCredentials.update).toHaveBeenCalledWith({
        where: { id: organizationCredentials.id },
        data: { email, password: organizationCredentials.password },
      });
    });

    test('Should update only password', async () => {
      const password = 'password';
      const encryptPassword = 'password for encryption';
      const encryptedPassword = `the encrption of password with encryptPassword`;

      vi.mocked(encrypt).mockReturnValue(encryptedPassword);
      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      await updateOrganizationCredentials('123', '321', undefined, password, encryptPassword);

      expect(prisma.organizationCredentials.update).toHaveBeenCalledWith({
        where: { id: organizationCredentials.id },
        data: { email: organizationCredentials.email, password: encryptedPassword },
      });
    });

    test('Should throw error if encrypt password is not provided', async () => {
      const email = 'email';
      const password = 'password';
      const encryptPassword = 'password for encryption';

      expect(() =>
        updateOrganizationCredentials('123', '321', email, password, encryptPassword),
      ).rejects.toThrow('Failed to update organization credentials');
    });

    test('Should throw error if credentials are not found', async () => {
      const email = 'email';
      const password = 'password';

      prisma.organizationCredentials.findFirst.mockResolvedValue(null);

      expect(() => updateOrganizationCredentials('123', '321', email, password)).rejects.toThrow(
        'Failed to update organization credentials',
      );
    });
  });

  describe('addOrganizationCredentials', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should add organization credentials that does not exist without keychain', async () => {
      const email = 'email';
      const password = 'password';
      const encryptPassword = 'password for encryption';
      const encryptedPassword = `the encrption of password with encryptPassword`;

      vi.mocked(encrypt).mockReturnValue(encryptedPassword);
      prisma.organizationCredentials.create.mockResolvedValue(organizationCredentials);

      const result = await addOrganizationCredentials(
        email,
        password,
        '123',
        '321',
        'token',
        encryptPassword,
      );

      expect(result).toEqual(true);
      expect(prisma.organizationCredentials.create).toHaveBeenCalledWith({
        data: {
          email,
          password: encryptedPassword,
          jwtToken: 'token',
          organization_id: '123',
          user_id: '321',
        },
      });
    });

    test('Should add organization credentials that does not exist with keychain', async () => {
      const email = 'email';
      const password = 'password';
      const encryptedPassword = Buffer.from('the encrption of password with encryptPassword');

      vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(true);
      vi.mocked(safeStorage.encryptString).mockReturnValue(encryptedPassword);
      prisma.organizationCredentials.create.mockResolvedValue(organizationCredentials);

      const result = await addOrganizationCredentials(email, password, '123', '321', 'token', null);

      expect(result).toEqual(true);
      expect(prisma.organizationCredentials.create).toHaveBeenCalledWith({
        data: {
          email,
          password: encryptedPassword.toString('base64'),
          jwtToken: 'token',
          organization_id: '123',
          user_id: '321',
        },
      });
    });

    test('Should update organization credentials if it exists', async () => {
      const email = 'email';
      const password = 'password';
      const encryptPassword = 'password for encryption';
      const encryptedPassword = `the encrption of password with encryptPassword`;

      vi.mocked(encrypt).mockReturnValue(encryptedPassword);
      prisma.organizationCredentials.count.mockResolvedValue(1);
      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      const result = await addOrganizationCredentials(
        email,
        password,
        '123',
        '321',
        'token',
        encryptPassword,
        true,
      );

      expect(result).toEqual(undefined);
      expect(prisma.organizationCredentials.update).toHaveBeenCalledWith({
        where: { id: organizationCredentials.id },
        data: { email, password: encryptedPassword, jwtToken: 'token' },
      });
    });

    test('Should throw error if organization credentials exists', async () => {
      const email = 'email';
      const password = 'password';
      const encryptPassword = 'password for encryption';

      prisma.organizationCredentials.create.mockRejectedValue('Database Error');

      expect(() =>
        addOrganizationCredentials(email, password, '123', '321', 'token', encryptPassword, true),
      ).rejects.toThrow('Failed to add organization credentials');
    });

    test('Should throw error if no encrypt password is provided and keychain is not used', async () => {
      const email = 'email';
      const password = 'password';

      vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(false);
      prisma.organizationCredentials.create.mockResolvedValue(organizationCredentials);

      await expect(
        addOrganizationCredentials(email, password, '123', '321', 'token', null),
      ).rejects.toThrow('Failed to add organization credentials');
    });
  });

  describe('deleteOrganizationCredentials', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return true if the credentials are deleted', async () => {
      const result = await deleteOrganizationCredentials('123', '321');

      expect(result).toEqual(true);
      expect(prisma.organizationCredentials.deleteMany).toHaveBeenCalledWith({
        where: { user_id: '321', organization_id: '123' },
      });
    });

    test('Should throw error if there is a database error', async () => {
      prisma.organizationCredentials.deleteMany.mockRejectedValue('Database error');

      expect(() => deleteOrganizationCredentials('123', '321')).rejects.toThrow(
        'Failed to delete organization credentials',
      );
    });
  });

  describe('tryAutoSignIn', () => {
    beforeEach(() => {
      vi.resetAllMocks();

      const ses = {
        cookies: {
          set: vi.fn(),
          get: vi.fn().mockResolvedValue([]),
        },
      } as unknown as Electron.Session;
      vi.mocked(session.fromPartition).mockReturnValue(ses);
    });

    const urlHost = 'localhost';
    const serverUrl = `http://${urlHost}:3000`;
    const credentials = [
      {
        ...organizationCredentials,
        organization: {
          serverUrl,
        },
      },
    ];

    test('Should return empty array when successfully signed in in all organizations that requires sign in', async () => {
      const decryptedPassword = 'password';

      prisma.organizationCredentials.findMany.mockResolvedValue(credentials);
      vi.mocked(decrypt).mockReturnValue(decryptedPassword);
      vi.mocked(login).mockResolvedValue({ id: 2, accessToken: 'token' });

      const result = await tryAutoSignIn('123', '321');

      expect(result).toEqual([]);
    });

    test('Should return NON empty array when there are organizations that requires sign in', async () => {
      const decryptedPassword = 'password';

      prisma.organizationCredentials.findMany.mockResolvedValue(credentials);
      vi.mocked(decrypt).mockReturnValue(decryptedPassword);
      vi.mocked(login).mockRejectedValue('Failed login in server');

      const result = await tryAutoSignIn('123', '321');

      expect(result.length).toBeGreaterThan(0);
    });

    test('Should return NON empty array when failed to decrypt user credentials', async () => {
      prisma.organizationCredentials.findMany.mockResolvedValue(credentials);
      vi.mocked(decrypt).mockImplementation(() => {
        throw new Error('Incorrect decryption password');
      });
      vi.mocked(login).mockRejectedValue('Failed login in server');

      expect(() => tryAutoSignIn('123', '321')).rejects.toThrow('Incorrect decryption password');
    });
  });
});
