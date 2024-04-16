import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { Strategy } from 'passport-local';

import { User } from '@entities';

import { UsersService } from '../../users/users.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly usersService: UsersService) {
    super({ usernameField: 'email' });
  }

  validate(email: string, password: string): Promise<User> {
    return this.usersService.getVerifiedUser(email, password);
  }
}
