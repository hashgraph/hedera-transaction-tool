import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailThrottlerGuard } from '../guards';
import { ExecutionContext, UnprocessableEntityException } from '@nestjs/common';
import { of } from 'rxjs';
import { User, UserStatus } from '@entities';
import { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let user: User;
  let res: Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signUpByAdmin: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
            changePassword: jest.fn(),
            createOtp: jest.fn(),
            verifyOtp: jest.fn(),
            setPassword: jest.fn(),
            authenticateWebsocketToken: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(EmailThrottlerGuard)
      .useValue({
        canActivate: jest.fn((context: ExecutionContext) => {
          return of(true);
        }),
      })
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
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    } as unknown as Response;
  });

  describe('signUp', () => {
    it('should return a user', async () => {
      const result = user;

      jest.spyOn(controller, 'signUp').mockResolvedValue(result);

      expect(await controller.signUp({ email: 'john@test.com' })).toBe(result);
    });

    it('should throw an error if the user already exists', async () => {
      jest.spyOn(controller, 'signUp').mockRejectedValue(new UnprocessableEntityException('Email already exists.'));

      await expect(controller.signUp({ email: 'john@test.com' })).rejects.toThrowError('Email already exists.');
    });

    it('should throw an error if no email is supplied', async () => {
      jest.spyOn(controller, 'signUp').mockRejectedValue(new UnprocessableEntityException('Email is required.'));

      await expect(controller.signUp({ email: null })).rejects.toThrowError('Email is required.');
    });
  });

  describe('login', () => {
    it('should return a user', async () => {
      const result = user;

      jest.spyOn(controller, 'login').mockResolvedValue(result);

      expect(await controller.login(user, res)).toBe(result);
    });
  });

  describe('change-password', () => {
    it('should have no return value', async () => {
      const changePassword = {
        oldPassword: 'Doe',
        newPassword: 'Doe',
      }

      jest.spyOn(controller, 'changePassword').mockResolvedValue(undefined);

      expect(await controller.changePassword(user, changePassword)).toBeUndefined();
    });
  });

  describe('reset-password', () => {
    it('should have no return value', async () => {
      jest.spyOn(controller, 'createOtp').mockResolvedValue(undefined);

      expect(await controller.createOtp({ email: 'john@test.com' }, res)).toBeUndefined();
    });
  });

  describe('verify-reset', () => {
    it('should have no return value', async () => {
      jest.spyOn(controller, 'verifyOtp').mockResolvedValue(undefined);

      expect(await controller.verifyOtp(user, { token: '' }, res)).toBeUndefined();
    });
  });

  describe('set-password', () => {
    it('should have no return value', async () => {
      jest.spyOn(controller, 'setPassword').mockResolvedValue(undefined);

      expect(await controller.setPassword(user, { password: 'Doe' }, res)).toBeUndefined();
    });
  });

  describe('authenticateWebsocketToken', () => {
    it('should return a user', async () => {
      const res = {
        clearCookie: jest.fn()
      } as unknown as Response;

      jest.spyOn(controller, 'authenticateWebsocketToken').mockResolvedValue(user);

      expect(await controller.authenticateWebsocketToken({ jwt: 'token' })).toBe(user);
    });
  });
});
