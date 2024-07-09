import { ExecutionContext } from '@nestjs/common';
import { CurrentUserGuard } from './current-user.guard';

describe('CurrentUserGuard', () => {
  let guard: CurrentUserGuard;

  const mockExecutionContext = (user, params) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new CurrentUserGuard('userId');
  });

  it('should deny access if request does not have a user object', () => {
    const context = mockExecutionContext(null, { userId: '1' });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny access if request has a user object but no params', () => {
    const context = mockExecutionContext({ id: 1 }, null);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny access if user ID does not match the parameter value', () => {
    const context = mockExecutionContext({ id: 1 }, { userId: '2' });
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should grant access if user ID matches the parameter value', () => {
    const context = mockExecutionContext({ id: 1 }, { userId: '1' });
    expect(guard.canActivate(context)).toBe(true);
  });
});
