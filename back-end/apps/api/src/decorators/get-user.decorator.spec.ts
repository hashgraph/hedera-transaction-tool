import { ExecutionContext } from '@nestjs/common';
import { GetUserFactory } from './get-user.decorator';
import { UserStatus } from '@entities';

describe('GetUser Decorator', () => {
  it('should return the user object from the request', () => {
    const user = {
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

    const mockExecutionContext: ExecutionContext = {
      switchToHttp: jest.fn().mockReturnThis(),
      getRequest: jest.fn().mockReturnValue({ user }),
    } as unknown as ExecutionContext;

    const userFactory = GetUserFactory(null, mockExecutionContext);

    expect(userFactory).toBe(user);
  });
});
