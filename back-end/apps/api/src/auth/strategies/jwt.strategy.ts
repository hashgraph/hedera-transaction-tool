import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { User } from '@entities';

import { UsersService } from '../../users/users.service';

import { JwtPayload } from '../../interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    super({
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate({ userId, iat, credentialVersion }: JwtPayload): Promise<User> {
    // Re-check age against the *current* JWT_EXPIRATION instead of trusting only
    // the token's own exp claim, which was computed from whatever JWT_EXPIRATION
    // was at issuance. This lets lowering JWT_EXPIRATION retroactively cut off
    // tokens already issued under a longer setting (exp alone can't do that -
    // it's fixed at sign time), while never extending a token past what its own
    // exp already promised, since that's still enforced separately above by
    // passport-jwt via ignoreExpiration: false.
    const expirationSeconds = Number(this.configService.get<number>('JWT_EXPIRATION')) * 24 * 60 * 60;
    if (typeof iat === 'number' && iat + expirationSeconds <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.getUser({ id: userId });

    if (!user) throw new UnauthorizedException();
    // Tokens issued before the credential version changed are no longer valid.
    // We treat a missing credentialVersion as version 0 for tokens issued before this version was
    // field was introduced; the first password change invalidates those too.
    if ((credentialVersion ?? 0) !== (user.credentialVersion ?? 0)) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
