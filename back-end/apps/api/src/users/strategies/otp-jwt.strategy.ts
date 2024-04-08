import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { User } from '@entities';
import { ConfigService } from '@nestjs/config';
import { OtpPayload } from '../../interfaces/otp-payload.interface';

@Injectable()
export class OtpJwtStrategy extends PassportStrategy(Strategy, 'otp-jwt') {
  constructor(private readonly usersService: UsersService,
              private readonly configService: ConfigService,
              ) {
    super({
      secretOrKey: configService.get('JWT_SECRET'),
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.['otp']
      ]),
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
