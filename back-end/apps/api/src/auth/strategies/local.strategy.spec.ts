import { Test } from '@nestjs/testing';
import { User } from '@entities';

import { UsersService } from '../../users/users.service';

import { LocalStrategy } from './local.strategy';

jest.mock('../../users/users.service');

describe('LocalStrategy', () => {
  let localStrategy: LocalStrategy;
  let usersService: UsersService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LocalStrategy, UsersService],
    }).compile();

    localStrategy = moduleRef.get<LocalStrategy>(LocalStrategy);
    usersService = moduleRef.get<UsersService>(UsersService);
  });

  it('should call getVerifiedUser with correct parameters', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    const mockUser: User = { id: 1, email, password } as User;

    jest.spyOn(usersService, 'getVerifiedUser').mockResolvedValue(mockUser);

    await localStrategy.validate(email, password);

    expect(usersService.getVerifiedUser).toHaveBeenCalledWith(email, password);
  });
});
