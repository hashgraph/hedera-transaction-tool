import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * @deprecated Kept only for pre-existing-client backward compatibility - see the
 * deprecation note on OtpJwtStrategy. Remove alongside it in the next
 * breaking-changes release.
 */
@Injectable()
export class OtpJwtAuthGuard extends AuthGuard('otp-jwt') {}
