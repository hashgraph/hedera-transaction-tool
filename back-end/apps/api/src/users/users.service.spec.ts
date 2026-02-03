import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { ErrorCodes, checkFrontendVersion } from '@app/common';
import { Client, User, UserKey } from '@entities';

import * as bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';

import { UsersService } from './users.service';

jest.mock('bcryptjs');
jest.mock('argon2');
jest.mock('@app/common', () => ({
  ...jest.requireActual('@app/common'),
  checkFrontendVersion: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;

  const userRepository = mockDeep<Repository<User>>();
  const clientRepository = mockDeep<Repository<Client>>();
  const configService = mockDeep<ConfigService>();

  const email = 'some@email.com';
  const password = 'password';
  const hashedPassword = 'hashedPassword';
  const user: Partial<User> = {
    email,
    password: hashedPassword,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(Client),
          useValue: clientRepository,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call the repo to find a user', async () => {
    const where: FindOptionsWhere<User> = {
      id: 1,
    };
    const withDeleted: boolean = true;

    await service.getUser(where, withDeleted);

    expect(userRepository.findOne).toHaveBeenCalledWith({ where, withDeleted });
  });

  it('should return null if where is null', async () => {
    const where: FindOptionsWhere<User> = null;
    const withDeleted: boolean = true;

    const result = await service.getUser(where, withDeleted);

    expect(result).toBeNull();
  });

  it('should return null if all values in where are null', async () => {
    const where: FindOptionsWhere<User> = {
      id: null,
    };
    const withDeleted: boolean = true;

    const result = await service.getUser(where, withDeleted);

    expect(result).toBeNull();
  });

  it('should call the repo to find all users', async () => {
    await service.getUsers();

    expect(userRepository.find).toHaveBeenCalled();
  });

  it('should call the repo to create a user', async () => {
    userRepository.findOne.mockResolvedValue(null);
    userRepository.create.mockReturnValue(user as User);
    jest.spyOn(service, 'hash').mockImplementation(async () => hashedPassword);

    await service.createUser(email, password);

    expect(userRepository.create).toHaveBeenCalledWith(user);
    expect(userRepository.save).toHaveBeenCalledWith(user);
  });

  it('should call the repo to restore a user', async () => {
    const userCopy = { ...user, id: 1, deletedAt: new Date() };
    userRepository.findOne.mockResolvedValue(userCopy as User);
    jest.spyOn(service, 'hash').mockImplementation(async () => hashedPassword);

    await service.createUser(email, password);

    expect(userRepository.save).toHaveBeenCalledWith({
      ...userCopy,
      status: 'NEW',
      deletedAt: null,
    });
  });

  it('should throw if the email already exists', async () => {
    userRepository.findOne.mockResolvedValue(user as User);

    await expect(service.createUser(email, password)).rejects.toThrowError('Email already exists.');
  });

  it('should return user that verifies the email and password', async () => {
    userRepository.findOne.mockResolvedValue(user as User);
    //@ts-expect-error - incorrect overload expected
    jest.mocked(bcrypt.compare).mockResolvedValue(true);
    jest.mocked(argon2.verify).mockResolvedValue(false);

    const result = await service.getVerifiedUser(email, password);

    expect(result).toEqual(user as User);
  });

  it('should throw if the user is not found', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.getVerifiedUser(email, password)).rejects.toThrow(
      'Please check your login credentials',
    );
  });

  it('should throw if find user throws error', async () => {
    userRepository.findOne.mockRejectedValue(new Error());

    await expect(service.getVerifiedUser(email, password)).rejects.toThrow(
      'Failed to retrieve user.',
    );
  });

  it('should throw if the password is incorrect', async () => {
    userRepository.findOne.mockResolvedValue(user as User);
    //@ts-expect-error - incorrect overload expected
    jest.mocked(bcrypt.compare).mockResolvedValue(false);
    jest.mocked(argon2.verify).mockResolvedValue(false);

    await expect(service.getVerifiedUser(email, password)).rejects.toThrow(
      'Please check your login credentials',
    );
  });

  it('should throw if the user is not found', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.updateUserById(1, {})).rejects.toThrow(ErrorCodes.UNF);
  });

  it('should call the repo to update a user', async () => {
    userRepository.findOne.mockResolvedValue(user as User);

    await service.updateUserById(1, { email });

    expect(userRepository.save).toHaveBeenCalledWith({
      ...user,
      email,
    });
  });

  it('should throw if the user is not found', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.updateUserById(1, {})).rejects.toThrow(ErrorCodes.UNF);
  });

  it('should set new password the user', async () => {
    userRepository.findOne.mockResolvedValue(user as User);
    jest.spyOn(service, 'hash').mockImplementation(async () => hashedPassword);

    await service.setPassword({ ...user } as User, password);

    expect(userRepository.save).toHaveBeenCalledWith({
      ...user,
      password: hashedPassword,
      status: 'NONE',
    });
  });

  it('should remove user and soft-delete all associated keys', async () => {
    userRepository.findOne.mockResolvedValue(user as User);
    userRepository.manager.softDelete.mockResolvedValue({ affected: 2, raw: [], generatedMaps: [] });

    await service.removeUser(1);

    // Verify keys are soft-deleted first
    expect(userRepository.manager.softDelete).toHaveBeenCalledWith(UserKey, { userId: 1 });
    // Then user is soft-deleted
    expect(userRepository.softRemove).toHaveBeenCalledWith(user);
  });

  it('should throw if the user is not found', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.removeUser(1)).rejects.toThrow(ErrorCodes.UNF);
  });

  it('should return the email of the user who owns the public key', async () => {
    const publicKey = '0bac491a279bc49db8ac4fb57a9a47ae1247ea91ab315a49247e042d60cc8765';
    const userWithKey = { email, keys: [{ publicKey }] } as User;

    userRepository.findOne.mockResolvedValue(userWithKey);

    const result = await service.getOwnerOfPublicKey(publicKey);

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { keys: { publicKey } },
      relations: ['keys'],
    });
    expect(result).toEqual(email);
  });

  it('should return null if no user is found for the given public key', async () => {
    const publicKey = '';

    userRepository.findOne.mockResolvedValue(null);

    const result = await service.getOwnerOfPublicKey(publicKey);

    expect(userRepository.findOne).toHaveBeenCalledWith({
      where: { keys: { publicKey } },
      relations: ['keys'],
    });
    expect(result).toBeNull();
  });

  it('should hash data without pseudo salt', async () => {
    const data = 'password';
    jest.mocked(argon2.hash).mockResolvedValue(hashedPassword);

    const result = await service.hash(data);

    expect(argon2.hash).toHaveBeenCalledWith(data, { salt: undefined });
    expect(result).toBe(hashedPassword);
  });

  it('should hash data with pseudo salt', async () => {
    const data = 'password';
    const pseudoSalt = Buffer.from('passwordxxxxxxxx'.slice(0, 16));
    jest.mocked(argon2.hash).mockResolvedValue(hashedPassword);

    const result = await service.hash(data, true);

    expect(argon2.hash).toHaveBeenCalledWith(data, { salt: pseudoSalt });
    expect(result).toBe(hashedPassword);
  });

  it('should call get admins', async () => {
    await service.getAdmins();

    expect(userRepository.find).toHaveBeenCalledWith({
      where: { admin: true },
    });
  });

  describe('updateClientVersion', () => {
    const userId = 1;
    const version = '1.0.0';
    const newVersion = '1.1.0';

    it('should create a new client record when none exists', async () => {
      const newClient: Partial<Client> = { userId, version };
      clientRepository.findOne.mockResolvedValue(null);
      clientRepository.create.mockReturnValue(newClient as Client);
      clientRepository.save.mockResolvedValue(newClient as Client);

      const result = await service.updateClientVersion(userId, version);

      expect(clientRepository.findOne).toHaveBeenCalledWith({ where: { userId } });
      expect(clientRepository.create).toHaveBeenCalledWith({ userId, version });
      expect(clientRepository.save).toHaveBeenCalledWith(newClient);
      expect(result).toEqual(newClient);
    });

    it('should update existing client record when version changes', async () => {
      const existingClient: Partial<Client> = { id: 1, userId, version };
      const updatedClient: Partial<Client> = { id: 1, userId, version: newVersion };
      clientRepository.findOne.mockResolvedValue(existingClient as Client);
      clientRepository.save.mockResolvedValue(updatedClient as Client);

      const result = await service.updateClientVersion(userId, newVersion);

      expect(clientRepository.findOne).toHaveBeenCalledWith({ where: { userId } });
      expect(clientRepository.save).toHaveBeenCalledWith({
        ...existingClient,
        version: newVersion,
      });
      expect(result).toEqual(updatedClient);
    });

    it('should not update when version is the same', async () => {
      const existingClient: Partial<Client> = { id: 1, userId, version };
      clientRepository.findOne.mockResolvedValue(existingClient as Client);

      const result = await service.updateClientVersion(userId, version);

      expect(clientRepository.findOne).toHaveBeenCalledWith({ where: { userId } });
      expect(clientRepository.save).not.toHaveBeenCalled();
      expect(clientRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingClient);
    });
  });

  describe('getVersionCheckInfo', () => {
    const latestVersion = '1.0.0';
    const minimumVersion = '0.9.0';
    const repoUrl = 'https://github.com/hashgraph/hedera-transaction-tool/releases';

    beforeEach(() => {
      // Setup config service mock for version check
      configService.get.mockImplementation((key: string) => {
        switch (key) {
          case 'LATEST_SUPPORTED_FRONTEND_VERSION':
            return latestVersion;
          case 'MINIMUM_SUPPORTED_FRONTEND_VERSION':
            return minimumVersion;
          case 'FRONTEND_REPO_URL':
            return repoUrl;
          default:
            return undefined;
        }
      });
    });

    it('should call checkFrontendVersion with config values', () => {
      const userVersion = '0.9.5';
      const mockResult = {
        latestSupportedVersion: latestVersion,
        minimumSupportedVersion: minimumVersion,
        updateUrl: `${repoUrl}/v${latestVersion}/`,
      };
      jest.mocked(checkFrontendVersion).mockReturnValue(mockResult);

      const result = service.getVersionCheckInfo(userVersion);

      expect(configService.get).toHaveBeenCalledWith('LATEST_SUPPORTED_FRONTEND_VERSION');
      expect(configService.get).toHaveBeenCalledWith('MINIMUM_SUPPORTED_FRONTEND_VERSION');
      expect(configService.get).toHaveBeenCalledWith('FRONTEND_REPO_URL');
      expect(checkFrontendVersion).toHaveBeenCalledWith(
        userVersion,
        latestVersion,
        minimumVersion,
        repoUrl,
      );
      expect(result).toEqual(mockResult);
    });

    it('should return result when user has latest version', () => {
      const userVersion = '1.0.0';
      const mockResult = {
        latestSupportedVersion: latestVersion,
        minimumSupportedVersion: minimumVersion,
        updateUrl: null,
      };
      jest.mocked(checkFrontendVersion).mockReturnValue(mockResult);

      const result = service.getVersionCheckInfo(userVersion);

      expect(result.updateUrl).toBeNull();
    });

    it('should return result when update is available', () => {
      const userVersion = '0.9.5';
      const mockResult = {
        latestSupportedVersion: latestVersion,
        minimumSupportedVersion: minimumVersion,
        updateUrl: `${repoUrl}/v${latestVersion}/`,
      };
      jest.mocked(checkFrontendVersion).mockReturnValue(mockResult);

      const result = service.getVersionCheckInfo(userVersion);

      expect(result.updateUrl).toBe(`${repoUrl}/v${latestVersion}/`);
    });

    it('should handle missing config values gracefully', () => {
      // Override config to return undefined for all version-related keys
      // Note: In production, config is required, so this scenario won't occur
      configService.get.mockReturnValue(undefined);

      const mockResult = {
        latestSupportedVersion: '',
        minimumSupportedVersion: '',
        updateUrl: null,
      };
      jest.mocked(checkFrontendVersion).mockReturnValue(mockResult);

      const result = service.getVersionCheckInfo('1.0.0');

      expect(checkFrontendVersion).toHaveBeenCalledWith('1.0.0', undefined, undefined, undefined);
      expect(result).toEqual(mockResult);
    });

    it('should handle user version newer than latest supported', () => {
      const userVersion = '2.0.0';
      const mockResult = {
        latestSupportedVersion: latestVersion,
        minimumSupportedVersion: minimumVersion,
        updateUrl: null,
      };
      jest.mocked(checkFrontendVersion).mockReturnValue(mockResult);

      const result = service.getVersionCheckInfo(userVersion);

      expect(result.updateUrl).toBeNull();
    });
  });
});
