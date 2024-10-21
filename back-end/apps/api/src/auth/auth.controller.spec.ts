import { UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';
import { Request } from 'express';

import { BlacklistService, guardMock } from '@app/common';
import { User, UserStatus } from '@entities';

import { AuthController } from './auth.controller';

import { AuthService } from './auth.service';

import { EmailThrottlerGuard } from '../guards';

describe('AuthController', () => {
  let controller: AuthController;
  let user: User;

  const authService = mockDeep<AuthService>();
  const blacklistService = mockDeep<BlacklistService>();

  const request: Request = {
    protocol: 'http',
    get: jest.fn(),
  } as unknown as Request;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: BlacklistService,
          useValue: blacklistService,
        },
      ],
    })
      .overrideGuard(EmailThrottlerGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<AuthController>(AuthController);
    user = {
      id: 1,
      email: 'john@test.com',
      password: 'Doe',
      admin: false,
      status: UserStatus.NEW,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      keys: [],
      signerForTransactions: [],
      observableTransactions: [],
      approvableTransactions: [],
      comments: [],
      issuedNotifications: [],
      receivedNotifications: [],
      notificationPreferences: [],
    };
  });

  describe('signUp', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should return a user', async () => {
      const result = user;

      jest.mocked(request.get).mockImplementationOnce(() => 'localhost');
      authService.signUpByAdmin.mockResolvedValue(result);

      expect(await controller.signUp({ email: 'john@test.com' }, request)).toBe(result);
    });

    it('should throw an error if the user already exists', async () => {
      jest.mocked(request.get).mockImplementationOnce(() => 'localhost');
      jest
        .spyOn(controller, 'signUp')
        .mockRejectedValue(new UnprocessableEntityException('Email already exists.'));

      await expect(controller.signUp({ email: 'john@test.com' }, request)).rejects.toThrow(
        'Email already exists.',
      );
    });

    it('should throw an error if no email is supplied', async () => {
      jest.mocked(request.get).mockImplementationOnce(() => 'localhost');
      jest
        .spyOn(controller, 'signUp')
        .mockRejectedValue(new UnprocessableEntityException('Email is required.'));

      await expect(controller.signUp({ email: null }, request)).rejects.toThrow(
        'Email is required.',
      );
    });
  });

  describe('login', () => {
    it('should return a user', async () => {
      await controller.login(user);

      expect(authService.login).toHaveBeenCalledWith(user);
    });
  });

  describe('change-password', () => {
    it('should have no return value', async () => {
      const changePassword = {
        oldPassword: 'Doe',
        newPassword: 'Doe',
      };

      authService.changePassword.mockResolvedValue(undefined);

      expect(await controller.changePassword(user, changePassword)).toBeUndefined();
    });
  });

  describe('reset-password', () => {
    it('should have no return value', async () => {
      authService.createOtp.mockResolvedValue(undefined);

      expect(await controller.createOtp({ email: 'john@test.com' })).toBeUndefined();
    });
  });

  describe('verify-reset', () => {
    it('should have no return value', async () => {
      authService.verifyOtp.mockResolvedValue(undefined);

      expect(await controller.verifyOtp(user, { token: '' })).toBeUndefined();
    });
  });

  describe('set-password', () => {
    it('should have no return value', async () => {
      authService.setPassword.mockResolvedValue(undefined);

      expect(await controller.setPassword(user, { password: 'Doe' })).toBeUndefined();
    });
  });

  describe('authenticateWebsocketToken', () => {
    it('should return a user', async () => {
      authService.authenticateWebsocketToken.mockResolvedValue(user);

      expect(await controller.authenticateWebsocketToken({ jwt: 'token' })).toBe(user);
    });
  });

  describe('logout', () => {
    it('should have no return value', async () => {
      expect(await controller.logout()).toBeUndefined();
    });
  });
});
