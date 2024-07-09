import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { User } from '@entities';

import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

const mockUsersService = mockDeep<UsersService>();
const mockConfigService = mockDeep<ConfigService>();

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;

  beforeEach(async () => {
    jest.resetAllMocks();

    mockConfigService.get.mockReturnValue('secret');

    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should return a user when validate is called with a valid userId', async () => {
    const user = { id: 1, email: 'test@test.com' };
    mockUsersService.getUser.mockResolvedValue(user as User);

    const result = await jwtStrategy.validate({ userId: user.id, email: user.email });
    expect(result).toEqual(user);
  });

  it('should throw UnauthorizedException when no user is found', async () => {
    mockUsersService.getUser.mockResolvedValue(null);

    await expect(jwtStrategy.validate({ userId: 13213, email: 'sdads' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
