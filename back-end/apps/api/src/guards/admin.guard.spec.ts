import { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;

  const mockExecutionContext = user =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('should deny access if request does not have a user object', () => {
    const context = mockExecutionContext(null);
    expect(guard.canActivate(context)).toBeFalsy();
  });

  it('should deny access if request has a user object but the user is not an admin', () => {
    const context = mockExecutionContext({ admin: false });
    expect(guard.canActivate(context)).toBeFalsy();
  });

  it('should grant access if request has a user object and the user is an admin', () => {
    const context = mockExecutionContext({ admin: true });
    expect(guard.canActivate(context)).toBe(true);
  });
});
