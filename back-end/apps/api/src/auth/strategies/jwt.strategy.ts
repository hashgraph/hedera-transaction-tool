import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';
import { User } from '@entities/';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService,
              private readonly configService: ConfigService) {
    super({
      secretOrKey: configService.get('JWT_SECRET'),
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.Authentication,
      ]),
    });
  }

  async validate({ userId }: JwtPayload): Promise<User> {
    const user = await this.usersService.getUser({ id: userId });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
