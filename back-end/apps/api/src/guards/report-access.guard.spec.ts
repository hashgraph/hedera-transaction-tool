import { ExecutionContext } from '@nestjs/common';
import { ReportAccessGuard } from './report-access.guard';

describe('ReportAccessGuard', () => {
  let guard: ReportAccessGuard;

  const mockExecutionContext = (user: unknown) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new ReportAccessGuard();
  });

  it('should deny access if request does not have a user object', () => {
    const context = mockExecutionContext(null);
    expect(guard.canActivate(context)).toBeFalsy();
  });

  it('should deny access if the user is neither admin nor report-eligible', () => {
    const context = mockExecutionContext({ admin: false, canViewReports: false });
    expect(guard.canActivate(context)).toBeFalsy();
  });

  it('should grant access if the user is an admin', () => {
    const context = mockExecutionContext({ admin: true, canViewReports: false });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should grant access if the user has canViewReports', () => {
    const context = mockExecutionContext({ admin: false, canViewReports: true });
    expect(guard.canActivate(context)).toBe(true);
  });
});
