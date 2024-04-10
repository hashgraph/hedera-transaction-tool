import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';

import { Response } from 'express';
import * as bcrypt from 'bcryptjs';

import { NOTIFICATIONS_SERVICE } from '@app/common';
import { User } from '@entities';

import { JwtPayload } from '../interfaces/jwt-payload.interface';

import { UsersService } from '../users/users.service';

import { ChangePasswordDto, SignUpUserDto } from './dtos';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
  ) {}

  /* Register a new user by admins and send him an email with the temporary password */
  async signUpByAdmin(dto: SignUpUserDto): Promise<User> {
    const tempPassword = this.generatePassword();

    const user = await this.usersService.createUser(dto.email, tempPassword);

    this.notificationsService.emit('notify_email', {
      subject: 'Hedera Transaction Tool Registration',
      email: user.email,
      text: `You have been registered in Hedera Transaction Tool.\nYour temporary password is: <b>${tempPassword}</b>`,
    });

    return user;
  }

  /* The user is already verified, create the token and put it in the cookie for the response. */
  async login(user: User, response: Response) {
    const payload: JwtPayload = { userId: user.id, email: user.email };

    const expires = new Date();
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

  /* Log the user out of the organization, remove his cooke and blacklists his token */
  logout(response: Response) {
    response.clearCookie('Authentication');
    //TODO implement token blacklisting
  }

  /* Change the password for the given user */
  async changePassword(user: User, { oldPassword, newPassword }: ChangePasswordDto): Promise<void> {
    if (oldPassword === newPassword)
      throw new BadRequestException('New password should not be the old password');

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) throw new BadRequestException('Invalid old password');

    await this.usersService.setPassword(user, newPassword);
  }

  private generatePassword() {
    const randomValue = crypto.getRandomValues(new Uint32Array(8));
    return Buffer.from(randomValue).toString('base64');
  }
}
