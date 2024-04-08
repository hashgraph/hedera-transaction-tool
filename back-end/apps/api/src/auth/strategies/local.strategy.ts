import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UsersService } from '../../users/users.service';
import { User } from '@entities';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly usersService: UsersService) {
    super({ usernameField: 'email' });
  }

  // In order to a user to sign in, an email and password is supplied. Passport appears to
  // require both to be present, not null, and not empty.
  async validate(email: string, password: string): Promise<User> {
    try {
      return await this.usersService.getVerifiedUser(email, password);
    } catch (err) {
      throw new UnauthorizedException(err);
    }
  }
}