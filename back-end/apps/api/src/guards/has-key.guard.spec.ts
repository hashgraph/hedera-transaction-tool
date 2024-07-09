import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HasKeyGuard } from './has-key.guard';
import { UserKeysService } from '../user-keys/user-keys.service';

describe('HasKeyGuard', () => {
  let hasKeyGuard: HasKeyGuard;
  let userKeysService: UserKeysService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HasKeyGuard,
        {
          provide: UserKeysService,
          useValue: {
            getUserKeysCount: jest.fn(),
          },
        },
      ],
    }).compile();

    hasKeyGuard = moduleRef.get<HasKeyGuard>(HasKeyGuard);
    userKeysService = moduleRef.get<UserKeysService>(UserKeysService);
  });

  it('should deny access if user does not exist in request', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as ExecutionContext;

    expect(await hasKeyGuard.canActivate(context)).toBe(false);
  });

  it('should deny access if an error occurs while fetching keys', async () => {
    jest
      .spyOn(userKeysService, 'getUserKeysCount')
      .mockRejectedValue(new Error('Error fetching keys'));
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 1 } }),
      }),
    } as ExecutionContext;

    expect(await hasKeyGuard.canActivate(context)).toBe(false);
  });

  it('should throw UnauthorizedException if user has no keys', async () => {
    jest.spyOn(userKeysService, 'getUserKeysCount').mockResolvedValue(0);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 1 } }),
      }),
    } as ExecutionContext;

    await expect(hasKeyGuard.canActivate(context)).rejects.toThrow(
      'You should have at least one key to perform this action.',
    );
  });

  it('should grant access if user has keys', async () => {
    jest.spyOn(userKeysService, 'getUserKeysCount').mockResolvedValue(1);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 1 } }),
      }),
    } as ExecutionContext;

    expect(await hasKeyGuard.canActivate(context)).toBe(true);
  });
});
