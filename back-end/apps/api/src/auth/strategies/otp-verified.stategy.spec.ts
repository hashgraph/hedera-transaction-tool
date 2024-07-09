import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { User } from '@entities';

import { OtpVerifiedStrategy } from './otp-verified.strategy';
import { UsersService } from '../../users/users.service';

describe('OtpVerifiedStrategy', () => {
  let strategy: OtpVerifiedStrategy;
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpVerifiedStrategy,
        {
          provide: UsersService,
          useValue: {
            getUser: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<OtpVerifiedStrategy>(OtpVerifiedStrategy);
    usersService = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should throw UnauthorizedException if verified is false', async () => {
    await expect(strategy.validate({ email: 'test@example.com', verified: false })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException if user does not exist', async () => {
    jest.spyOn(usersService, 'getUser').mockResolvedValue(null);
    await expect(strategy.validate({ email: 'test@example.com', verified: true })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should return user if verified is true and user exists', async () => {
    const user = { id: 1, email: 'test@example.com' };
    jest.spyOn(usersService, 'getUser').mockResolvedValue(user as User);
    await expect(strategy.validate({ email: 'test@example.com', verified: true })).resolves.toEqual(
      user,
    );
  });
});
