import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';

import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { totp } from 'otplib';

import { ELECTRON_APP_PROTOCOL_PREFIX, NOTIFICATIONS_SERVICE } from '@app/common';
import { User, UserStatus } from '@entities';

import { JwtPayload, OtpPayload } from '../interfaces';

import { UsersService } from '../users/users.service';

import { ChangePasswordDto, SignUpUserDto, OtpDto } from './dtos';

totp.options = {
  digits: 8,
  step: 60,
  window: 20,
};

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

    const accessToken: string = this.jwtService.sign(payload, {
      expiresIn: `${this.configService.get('JWT_EXPIRATION')}d`,
    });

    const expires = new Date();
    expires.setSeconds(
      expires.getSeconds() + this.configService.get<number>('JWT_EXPIRATION') * 24 * 60 * 60,
    );

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

  /* Create OTP and send it to the user */
  async createOtp(user: User, response: Response): Promise<void> {
    const secret = this.getOtpSecret(user.email);
    const token = totp.generate(secret);

    this.notificationsService.emit('notify_email', {
      email: user.email,
      subject: 'Password Reset token',
      text: `
      <div>
        <h1 style="margin: 0">Hedera Transaction Tool</h1>
        <p style="margin: 0">Use the following token to reset your password: <b>${token}</b></p>
        <a href="${ELECTRON_APP_PROTOCOL_PREFIX}token=${token}" style="text-decoration: none; color: white; background-color: #6600cc; padding: 8px 22px; border-radius: 6px;">Verify</a>
      </div>
      `,
    });

    this.setOtpCookie(response, { email: user.email, verified: false });
  }

  async verifyOtp(user: User, { token }: OtpDto, response: Response): Promise<void> {
    const secret = this.getOtpSecret(user.email);

    if (!totp.check(token, secret)) throw new UnauthorizedException('Incorrect token');

    try {
      await this.usersService.updateUser(user, { status: UserStatus.NEW });
      this.setOtpCookie(response, { email: user.email, verified: true });
    } catch (err) {
      throw new InternalServerErrorException('Error while updating user status');
    }
  }

  /* Return unique OTP secret for each user */
  private getOtpSecret(email: string): string {
    return this.configService.get<string>('OTP_SECRET').concat(email);
  }

  /* Sets the OTP cookie with the payload */
  private setOtpCookie(response: Response, otpPayload: OtpPayload) {
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + totp.options.step * (totp.options.window as number));

    const accessToken: string = this.jwtService.sign(otpPayload);
    response.cookie('otp', accessToken, {
      httpOnly: true,
      expires,
      sameSite: this.configService.get('NODE_ENV') === 'production' ? 'none' : 'lax',
      secure: this.configService.get('NODE_ENV') === 'production',
    });
  }

  clearOtpCookie(response: Response) {
    response.clearCookie('otp', {
      httpOnly: true,
      sameSite: this.configService.get('NODE_ENV') === 'production' ? 'none' : 'lax',
      secure: this.configService.get('NODE_ENV') === 'production',
    });
  }

  /* Set the password for verified user. */
  async setPassword(user: User, newPassword: string): Promise<void> {
    await this.usersService.setPassword(user, newPassword);
  }
}
