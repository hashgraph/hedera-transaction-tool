import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UsersService } from '../../users/users.service';
import { User } from '@entities';

@Injectable()
export class OtpLocalStrategy extends PassportStrategy(Strategy, 'otp-local') {
  constructor(private readonly usersService: UsersService) {
    super({
      usernameField: 'email',
      passwordField: 'email',
    });
  }

  async validate(email: string): Promise<User> {
    const user = await this.usersService.getUser({ email });

    if (!user) throw new UnauthorizedException("User doesn't exist.");

    return user;
  }
}
