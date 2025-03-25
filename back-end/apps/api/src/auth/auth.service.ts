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

import { totp } from 'otplib';
import * as bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';

import {
  ELECTRON_APP_PROTOCOL_PREFIX,
  ErrorCodes,
  NOTIFICATIONS_SERVICE,
  NOTIFY_EMAIL,
  NOTIFY_GENERAL,
  NotifyEmailDto,
  NotifyGeneralDto,
} from '@app/common';
import { NotificationType, User, UserStatus } from '@entities';

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
  async signUpByAdmin(dto: SignUpUserDto, url: string): Promise<User> {
    const tempPassword = this.generatePassword();

    const existingUser = await this.usersService.getUser({ email: dto.email }, true);
    let user: User;

    if (existingUser && !existingUser.deletedAt && existingUser.status === UserStatus.NEW) {
      const hashedPass = await this.usersService.getSaltedHash(tempPassword);
      user = await this.usersService.updateUserById(existingUser.id, { password: hashedPass });
    } else {
      user = await this.usersService.createUser(dto.email, tempPassword);
    }

    this.notificationsService.emit<undefined, NotifyEmailDto>(NOTIFY_EMAIL, {
      subject: 'Hedera Transaction Tool Registration',
      email: user.email,
      text: `You have been registered in Hedera Transaction Tool.\nThe Organization URL is: <b>${url}</b>\nYour temporary password is: <b>${tempPassword}</b>`,
    });

    return user;
  }

  /* The user is already verified, return jwt */
  async login(user: User) {
    const payload: JwtPayload = { userId: user.id, email: user.email };
    const expiresIn = `${this.configService.get('JWT_EXPIRATION')}d`;

    const accessToken: string = this.jwtService.sign(payload, {
      expiresIn,
    });

    return accessToken;
  }

  /* Change the password for the given user */
  async changePassword(user: User, { oldPassword, newPassword }: ChangePasswordDto): Promise<void> {
    if (oldPassword === newPassword) throw new BadRequestException(ErrorCodes.NPMOP);

    const { correct } = await this.dualCompareHash(oldPassword, user.password);
    if (!correct) throw new BadRequestException(ErrorCodes.INOP);

    if (user.status === UserStatus.NEW && user.keys.length === 0) {
      const admins = await this.usersService.getAdmins();
      this.notificationsService.emit<undefined, NotifyGeneralDto>(NOTIFY_GENERAL, {
        type: NotificationType.USER_REGISTERED,
        userIds: admins.map(admin => admin.id),
        content: `User ${user.email} has completed the registration process.`,
        entityId: user.id,
      });
    }

    await this.usersService.setPassword(user, newPassword);
  }

  /* Create OTP and send it to the user */
  async createOtp(email: string): Promise<{ token: string }> {
    const user = await this.usersService.getUser({ email });

    if (!user) return;

    const secret = this.getOtpSecret(user.email);
    const otp = totp.generate(secret);

    this.notificationsService.emit<undefined, NotifyEmailDto>(NOTIFY_EMAIL, {
      email: user.email,
      subject: 'Password Reset token',
      text: `
      <div>
        <h1 style="margin: 0">Hedera Transaction Tool</h1>
        <p style="margin: 0">Use the following token to reset your password: <b>${otp}</b></p>
        <a href="${ELECTRON_APP_PROTOCOL_PREFIX}token=${otp}" style="text-decoration: none; color: white; background-color: #6600cc; padding: 8px 22px; border-radius: 6px;">Verify</a>
      </div>
      `,
    });

    const token = this.getOtpToken({ email: user.email, verified: false });
    return { token };
  }

  async verifyOtp(user: User, { token }: OtpDto): Promise<{ token: string }> {
    const secret = this.getOtpSecret(user.email);

    if (!totp.check(token, secret)) throw new UnauthorizedException('Incorrect token');

    try {
      await this.usersService.updateUser(user, { status: UserStatus.NEW });
      const token = this.getOtpToken({ email: user.email, verified: true });
      return { token };
    } catch {
      throw new InternalServerErrorException('Error while updating user status');
    }
  }

  /* Return unique OTP secret for each user */
  private getOtpSecret(email: string): string {
    return this.configService.get<string>('OTP_SECRET').concat(email);
  }

  /* Sets the OTP jwt */
  private getOtpToken(otpPayload: OtpPayload) {
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + totp.options.step * (totp.options.window as number));

    return this.jwtService.sign(otpPayload, {
      expiresIn: `${this.configService.get('OTP_EXPIRATION')}m`,
    });
  }

  /* Set the password for verified user. */
  async setPassword(user: User, newPassword: string): Promise<void> {
    await this.usersService.setPassword(user, newPassword);
  }

  /* Generate a random password */
  private generatePassword() {
    const getRandomLetters = (length: number) =>
      Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join(
        '',
      );

    return `${getRandomLetters(5)}-${getRandomLetters(5)}`;
  }

  /* Attempt to authenticate the token. */
  async authenticateWebsocketToken(accessToken: string): Promise<User> {
    const { userId } = await this.jwtService.verifyAsync(accessToken);
    return this.usersService.getUser({ id: userId });
  }

  /* Elevate user to admin */
  async elevateAdmin(userId: number): Promise<void> {
    await this.usersService.updateUserById(userId, { admin: true });
  }

  /* Compare the given data with the hash */
  async dualCompareHash(data: string, hash: string) {
    const matchBcrypt = await bcrypt.compare(data, hash);
    const matchArgon2 = await argon2.verify(hash, data);
    return { correct: matchBcrypt || matchArgon2, isBcrypt: matchBcrypt };
  }
}
