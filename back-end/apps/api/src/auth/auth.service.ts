import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';

import { Response } from 'express';

import { NOTIFICATIONS_SERVICE } from '@app/common';
import { User } from '@entities';

import { JwtPayload } from '../interfaces/jwt-payload.interface';

import { UsersService } from '../users/users.service';

import { SignUpUserDto } from './dtos';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
  ) {}

  async signUpByAdmin(dto: SignUpUserDto): Promise<User> {
    const tempPassword = this.generatePassword();

    const user = await this.usersService.createUser({
      email: dto.email,
      password: tempPassword,
    });

    this.notificationsService.emit('notify_email', {
      subject: 'Hedera Transaction Tool Registration',
      email: user.email,
      text: `You have been registered in Hedera Transaction Tool.\nYour temporary password is: <b>${tempPassword}</b>`,
    });

    return user;
  }

  // The user is already verified, create the token and put it in the cookie for the response.
  async login(user: User, response: Response) {
    const payload: JwtPayload = { userId: user.id, email: user.email };

    // Get the expiration to set on the cookie
    const expires = new Date();
    //TODO is there a better way to make the cookie and the JWT expiration to match?
    expires.setSeconds(
      expires.getSeconds() + this.configService.get<number>('JWT_EXPIRATION') * 24 * 60 * 60,
    );

    const accessToken: string = this.jwtService.sign(payload);
    response.cookie('Authentication', accessToken, {
      httpOnly: true,
      expires,
      sameSite: this.configService.get('NODE_ENV') === 'production' ? 'none' : 'lax',
      secure: this.configService.get('NODE_ENV') === 'production',
    });
  }

  signOut() {
    // Get the token, add it to the blacklist, the user guard will need to compare the token to the blacklist
  }

  private generatePassword() {
    const randomValue = crypto.getRandomValues(new Uint32Array(8));
    return Buffer.from(randomValue).toString('base64');
  }
}
