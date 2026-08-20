import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { User } from '@entities';
import { ConfigService } from '@nestjs/config';
import { OtpPayload } from '../../interfaces';

/**
 * @deprecated Kept only for backward compatibility with clients that predate the
 * email+code /verify-reset contract - this JWT proves nothing (any caller can get
 * one for any email via /reset-password), so it isn't a real security boundary,
 * only a legacy way of carrying the email across the two requests. Remove this
 * strategy, OtpJwtAuthGuard, and the `verified: false` unverified-token branch of
 * createOtp/getOtpToken in the next breaking-changes release, once clients older
 * than that release are no longer supported (see MINIMUM_SUPPORTED_FRONTEND_VERSION).
 */
@Injectable()
export class OtpJwtStrategy extends PassportStrategy(Strategy, 'otp-jwt') {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    const jwtSecret = configService.get('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      secretOrKey: jwtSecret,
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromHeader('otp'),
    });
  }

  async validate({ email, verified }: OtpPayload): Promise<User> {
    if (verified) {
      throw new UnauthorizedException();
    }
    const user = await this.usersService.getUser({ email });
    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
