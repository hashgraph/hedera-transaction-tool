import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { User } from '@entities';

import { TransactionsService } from '../transactions/transactions.service';

import { TransactionAccessGuard } from './transaction-access.guard';

describe('TransactionAccessGuard', () => {
  let guard: TransactionAccessGuard;
  let transactionsService: jest.Mocked<
    Pick<TransactionsService, 'getTransactionWithVerifiedAccess'>
  >;

  const mockExecutionContext = (
    user: Partial<User> | undefined,
    params: Record<string, unknown> = {},
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user, params }),
      }),
    }) as ExecutionContext;

  beforeEach(async () => {
    transactionsService = {
      getTransactionWithVerifiedAccess: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionAccessGuard,
        {
          provide: TransactionsService,
          useValue: transactionsService,
        },
      ],
    }).compile();

    guard = moduleRef.get(TransactionAccessGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('should deny access when no user is in the request', async () => {
    const context = mockExecutionContext(undefined, { transactionId: '1' });
    expect(await guard.canActivate(context)).toBe(false);
    expect(transactionsService.getTransactionWithVerifiedAccess).not.toHaveBeenCalled();
  });

  it('should deny access when no transactionId is in the params', async () => {
    const user = { id: 1 } as User;
    const context = mockExecutionContext(user, {});
    expect(await guard.canActivate(context)).toBe(false);
    expect(transactionsService.getTransactionWithVerifiedAccess).not.toHaveBeenCalled();
  });

  it('should deny access when transactionId is not a valid integer', async () => {
    const user = { id: 1 } as User;
    const context = mockExecutionContext(user, { transactionId: 'not-a-number' });
    expect(await guard.canActivate(context)).toBe(false);
    expect(transactionsService.getTransactionWithVerifiedAccess).not.toHaveBeenCalled();
  });

  it('should read transactionId from request.params.transactionId', async () => {
    const user = { id: 1 } as User;
    transactionsService.getTransactionWithVerifiedAccess.mockResolvedValue(undefined);
    const context = mockExecutionContext(user, { transactionId: '42' });

    expect(await guard.canActivate(context)).toBe(true);
    expect(transactionsService.getTransactionWithVerifiedAccess).toHaveBeenCalledWith(42, user);
  });

  it('should allow access when the user has a relationship with the transaction', async () => {
    const user = { id: 1 } as User;
    transactionsService.getTransactionWithVerifiedAccess.mockResolvedValue(undefined);
    const context = mockExecutionContext(user, { transactionId: '1' });

    expect(await guard.canActivate(context)).toBe(true);
  });

  it('should propagate UnauthorizedException when the user has no relationship with the transaction', async () => {
    const user = { id: 99 } as User;
    transactionsService.getTransactionWithVerifiedAccess.mockRejectedValue(
      new UnauthorizedException("You don't have permission to view this transaction"),
    );
    const context = mockExecutionContext(user, { transactionId: '1' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
