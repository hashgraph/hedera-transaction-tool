import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

// Mirrors AdminGuard's shape, for routes gated on report-viewing eligibility
// (admin or canViewReports) rather than full admin - see
// ApiKeysService.assertEligible, which enforces the same rule at
// key-issuance time. Stack after JwtOrApiKeyGuard so it applies to both the
// JWT and API-key paths alike.
@Injectable()
export class ReportAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const { user } = context.switchToHttp().getRequest();
    return user && (user.admin || user.canViewReports);
  }
}
