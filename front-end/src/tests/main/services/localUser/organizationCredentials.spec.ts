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
  decryptData,
  organizationCredentialsInvalid,
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
          organizationId: organization.id,
          jwtToken: 'token',
        },
      ] as unknown as OrganizationCredentials[];

      prisma.organizationCredentials.findMany.mockResolvedValue(records);

      const result = await getOrganizationTokens('123');

      expect(result).toEqual([
        {
          organizationId: organization.id,
          jwtToken: 'token',
        },
      ]);
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
      vi.mocked(jwtDecode).mockReturnValue({ exp: Date.now() + 2 * 1000 });

      prisma.organizationCredentials.findMany.mockResolvedValue(credentials);

      const result = await organizationsToSignIn('123');

      expect(result).toEqual([
        {
          ...organizationCredentials,
          organization: {
            serverUrl,
          },
        },
      ]);
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

      prisma.organizationCredentials.findFirst.mockResolvedValue({
        ...organizationCredentials,
        jwtToken: tokenValue,
      });

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

      prisma.organizationCredentials.findFirst.mockResolvedValue({
        ...organizationCredentials,
        jwtToken: 'token',
      });
      vi.mocked(jwtDecode).mockReturnValue(payload);

      const result = await getCurrentUser(serverUrl);

      expect(result).toEqual(payload);
    });

    test('Should return null if there is not token', async () => {
      const urlHost = 'localhost';
      const serverUrl = `http://${urlHost}:3000`;

      prisma.organizationCredentials.findFirst.mockResolvedValue(null);

      const result = await getCurrentUser(serverUrl);

      expect(result).toEqual(null);
    });

    test('Should return null if an error occur', async () => {
      const urlHost = 'localhost';
      const serverUrl = `http://${urlHost}:3000`;

      prisma.organizationCredentials.findFirst.mockResolvedValue({
        ...organizationCredentials,
        jwtToken: 'token',
      });
      vi.mocked(jwtDecode).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await getCurrentUser(serverUrl);

      expect(result).toEqual(null);
    });

    test('Should return null if an error occur in get access token', async () => {
      const urlHost = 'localhost';
      const serverUrl = `http://${urlHost}:3000`;

      prisma.organizationCredentials.findFirst.mockRejectedValueOnce({
        ...organizationCredentials,
        jwtToken: 'token',
      });
      vi.mocked(jwtDecode).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await getCurrentUser(serverUrl);

      expect(result).toEqual(null);
    });

    test('Should return null if jwt is null', async () => {
      const urlHost = 'localhost';
      const serverUrl = `http://${urlHost}:3000`;

      prisma.organizationCredentials.findFirst.mockResolvedValueOnce({
        ...organizationCredentials,
        jwtToken: null,
      });
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

    test('Should return organization credentials with decrypted password using decrypt password', async () => {
      const decryptPassword = 'decryptPassword';
      const decryptedPassword = 'decryptedPassword';

      vi.mocked(getUseKeychainClaim).mockResolvedValue(false);
      vi.mocked(decrypt).mockReturnValue(decryptedPassword);
      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      const result = await getOrganizationCredentials('123', '321', decryptPassword);

      expect(prisma.organizationCredentials.findFirst).toHaveBeenCalledWith({
        where: { user_id: '321', organization_id: '123' },
      });
      expect(decrypt).toHaveBeenCalledWith(organizationCredentials.password, decryptPassword);
      expect(result).toEqual({
        ...organizationCredentials,
        password: decryptedPassword,
      });
    });

    test('Should return organization credentials with decrypted password using keychain', async () => {
      const decryptedPassword = 'decryptedPassword';
      const buffer = Buffer.from(organizationCredentials.password, 'base64');

      vi.mocked(getUseKeychainClaim).mockResolvedValue(true);
      vi.mocked(safeStorage.decryptString).mockReturnValue(decryptedPassword);
      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      const result = await getOrganizationCredentials('123', '321', null);

      expect(prisma.organizationCredentials.findFirst).toHaveBeenCalledWith({
        where: { user_id: '321', organization_id: '123' },
      });
      expect(safeStorage.decryptString).toHaveBeenCalledWith(buffer);
      expect(result).toEqual({
        ...organizationCredentials,
        password: decryptedPassword,
      });
    });

    test('Should return null if decryptPassword is null and keychain is not used', async () => {
      vi.mocked(getUseKeychainClaim).mockResolvedValue(false);
      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      const result = await getOrganizationCredentials('123', '321', null);

      expect(result).toEqual(null);
    });

    test('Should return null if database error occurs', async () => {
      prisma.organizationCredentials.findFirst.mockRejectedValue('Database error');

      const result = await getOrganizationCredentials('123', '321', 'password');

      expect(result).toEqual(null);
    });

    test('Should return null if decryption fails', async () => {
      vi.mocked(getUseKeychainClaim).mockResolvedValue(false);
      vi.mocked(decrypt).mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      const result = await getOrganizationCredentials('123', '321', 'wrongPassword');

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

      await updateOrganizationCredentials(
        '123',
        '321',
        email,
        password,
        undefined,
        encryptPassword,
      );

      expect(prisma.organizationCredentials.update).toHaveBeenCalledWith({
        where: { id: organizationCredentials.id },
        data: { email, password: encryptedPassword, jwtToken: organizationCredentials.jwtToken },
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
        data: {
          email,
          password: encryptedPassword.toString('base64'),
          jwtToken: organizationCredentials.jwtToken,
        },
      });
    });

    test('Should update only email', async () => {
      const email = 'email';

      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      await updateOrganizationCredentials('123', '321', email);

      expect(prisma.organizationCredentials.update).toHaveBeenCalledWith({
        where: { id: organizationCredentials.id },
        data: {
          email,
          password: organizationCredentials.password,
          jwtToken: organizationCredentials.jwtToken,
        },
      });
    });

    test('Should update only password', async () => {
      const password = 'password';
      const encryptPassword = 'password for encryption';
      const encryptedPassword = `the encrption of password with encryptPassword`;

      vi.mocked(encrypt).mockReturnValue(encryptedPassword);
      prisma.organizationCredentials.findFirst.mockResolvedValue(organizationCredentials);

      await updateOrganizationCredentials(
        '123',
        '321',
        undefined,
        password,
        undefined,
        encryptPassword,
      );

      expect(prisma.organizationCredentials.update).toHaveBeenCalledWith({
        where: { id: organizationCredentials.id },
        data: {
          email: organizationCredentials.email,
          password: encryptedPassword,
          jwtToken: organizationCredentials.jwtToken,
        },
      });
    });

    test('Should return false if credentials are not found', async () => {
      const email = 'email';
      const password = 'password';
      const encryptPassword = 'password for encryption';

      const result = await updateOrganizationCredentials(
        '123',
        '321',
        email,
        password,
        undefined,
        encryptPassword,
      );

      expect(result).toBe(false);
    });

    test('Should throw error if encrypt password is not provided', async () => {
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

  describe('decryptData', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('returns empty string when data is empty and does not attempt decryption', async () => {
      const result = await decryptData('');

      expect(result).toBe('');
      expect(getUseKeychainClaim).not.toHaveBeenCalled();
      expect(safeStorage.decryptString).not.toHaveBeenCalled();
      expect(decrypt).not.toHaveBeenCalled();
    });

    test('Should decrypt data using keychain', async () => {
      const encryptedData = 'encryptedData';
      const decryptedData = 'decryptedData';
      const buffer = Buffer.from(encryptedData, 'base64');

      vi.mocked(getUseKeychainClaim).mockResolvedValue(true);
      vi.mocked(safeStorage.decryptString).mockReturnValue(decryptedData);

      const result = await decryptData(encryptedData);

      expect(safeStorage.decryptString).toHaveBeenCalledWith(buffer);
      expect(result).toEqual(decryptedData);
    });

    test('Should decrypt data using decryption password', async () => {
      const encryptedData = 'encryptedData';
      const decryptedData = 'decryptedData';
      const decryptPassword = 'password';

      vi.mocked(getUseKeychainClaim).mockResolvedValue(false);
      vi.mocked(decrypt).mockReturnValue(decryptedData);

      const result = await decryptData(encryptedData, decryptPassword);

      expect(decrypt).toHaveBeenCalledWith(encryptedData, decryptPassword);
      expect(result).toEqual(decryptedData);
    });

    test('Should throw error if no decryption method is available', async () => {
      const encryptedData = 'encryptedData';

      vi.mocked(getUseKeychainClaim).mockResolvedValue(false);

      await expect(decryptData(encryptedData)).rejects.toThrow(
        'Password is required to decrypt sensitive',
      );
    });
  });

  describe('organizationCredentialsInvalid', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    const organization = {
      id: '321',
      nickname: 'organization',
      serverUrl: 'http://localhost:3000',
      key: 'key',
    };

    const validCredentials = {
      id: '1',
      user_id: '123',
      organization_id: '321',
      organization_user_id: 1,
      email: 'email',
      password: 'password',
      updated_at: new Date(),
      jwtToken: 'validToken',
      organization,
    };

    test('Should return true if credentials are missing', async () => {
      const result = await organizationCredentialsInvalid(null);
      expect(result).toBe(true);
    });

    test('Should return true if password is missing', async () => {
      const credentials = { ...validCredentials, password: '' };
      const result = await organizationCredentialsInvalid(credentials);
      expect(result).toBe(true);
    });

    test('Should return true if email is missing', async () => {
      const credentials = { ...validCredentials, email: '' };
      const result = await organizationCredentialsInvalid(credentials);
      expect(result).toBe(true);
    });

    test('Should return true if access token is missing', async () => {
      prisma.organizationCredentials.findFirst.mockResolvedValue(null);
      const result = await organizationCredentialsInvalid(validCredentials);
      expect(result).toBe(true);
    });

    test('Should return true if access token is expired', async () => {
      prisma.organizationCredentials.findFirst.mockResolvedValue({
        jwtToken: 'expired',
      } as unknown as OrganizationCredentials);
      vi.mocked(jwtDecode).mockReturnValue({ exp: Date.now() / 1000 - 1000 });
      const result = await organizationCredentialsInvalid(validCredentials);
      expect(result).toBe(true);
    });

    test('Should return true if jwt decode throws', async () => {
      prisma.organizationCredentials.findFirst.mockResolvedValue({
        jwtToken: 'expired',
      } as unknown as OrganizationCredentials);
      vi.mocked(jwtDecode).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });
      const result = await organizationCredentialsInvalid(validCredentials);
      expect(result).toBe(true);
    });

    test('Should return false if credentials are valid', async () => {
      prisma.organizationCredentials.findFirst.mockResolvedValue({
        jwtToken: 'validToken',
      } as unknown as OrganizationCredentials);
      vi.mocked(jwtDecode).mockReturnValue({ exp: Date.now() / 1000 + 1000 });
      const result = await organizationCredentialsInvalid(validCredentials);
      expect(result).toBe(false);
    });
  });
});
