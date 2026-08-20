import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { createHmac, randomInt } from 'crypto';

import * as bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';

import {
  ErrorCodes,
  emitUserRegistrationEmail,
  emitUserPasswordResetEmail,
  emitUserStatusUpdateNotifications,
  NatsPublisherService,
} from '@app/common';
import { User, UserStatus } from '@entities';

import { JwtPayload, OtpPayload } from '../interfaces';

import { UsersService } from '../users/users.service';

import { OtpStoreService } from './otp-store.service';

import { ChangePasswordDto, SignUpUserDto, OtpDto } from './dtos';

const OTP_DIGITS = 8;
const OTP_MAX_VALUE = 10 ** OTP_DIGITS;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly notificationsPublisher: NatsPublisherService,
    private readonly otpStoreService: OtpStoreService,
  ) {}

  /* Register a new user by admins and send an email with the temporary password */
  async signUpByAdmin(dto: SignUpUserDto, fallbackUrl: string): Promise<User> {
    const url = this.resolveServerUrl(fallbackUrl);
    const rawRepoUrl = this.configService.get<string>('FRONTEND_REPO_URL');
    const repoUrl = rawRepoUrl ? rawRepoUrl.replace(/\/+$/, '') : '';
    const downloadUrl = `${repoUrl}/latest`;
    const tempPassword = this.generatePassword();

    const existingUser = await this.usersService.getUser({ email: dto.email }, true);
    let user: User;

    if (existingUser && !existingUser.deletedAt && existingUser.status === UserStatus.NEW) {
      const hashedPass = await this.usersService.getSaltedHash(tempPassword);
      user = await this.usersService.updateUserById(existingUser.id, { password: hashedPass });
    } else {
      user = await this.usersService.createUser(dto.email, tempPassword);
    }

    this.logger.log(`User ${user.id} registered and temporary password generated.`);

    emitUserRegistrationEmail(this.notificationsPublisher, [{ email: user.email, additionalData: { url, tempPassword, downloadUrl } }]);

    return user;
  }

  /* The user is already verified, return jwt */
  async login(user: User) {
    const payload: JwtPayload = { userId: user.id, email: user.email };
    const expiresIn = `${this.configService.get('JWT_EXPIRATION')}d` as StringValue;

    return this.jwtService.sign(payload, {
      expiresIn,
    });
  }

  /* Change the password for the given user */
  async changePassword(user: User, { oldPassword, newPassword }: ChangePasswordDto): Promise<void> {
    if (oldPassword === newPassword) throw new BadRequestException(ErrorCodes.NPMOP);

    const { correct } = await this.dualCompareHash(oldPassword, user.password);
    if (!correct) throw new BadRequestException(ErrorCodes.INOP);

    if (user.status === UserStatus.NEW && user.keys.length === 0) {
      emitUserStatusUpdateNotifications(this.notificationsPublisher, { entityId: user.id, additionalData: { username: user.email } });
    }

    await this.usersService.setPassword(user, newPassword);
  }

  /* Create OTP and send it to the user */
  async createOtp(email: string, fallbackUrl: string): Promise<{ token: string } | null> {
    const user = await this.usersService.getUser({ email });

    if (!user) return null;

    // A legitimate new request always gets a clean slate of attempts, and
    // replaces whatever code (if any) was previously pending.
    await this.otpStoreService.resetFailedAttempts(user.email);
    if (!secret) return null;

    const otp = this.generateOtp();
    await this.otpStoreService.storeCodeHash(user.email, this.hashOtp(otp), this.getOtpWindowSeconds());

    const serverUrl = this.resolveServerUrl(fallbackUrl);
    await emitUserPasswordResetEmail(this.notificationsPublisher, [{ email: user.email, additionalData: { otp, serverUrl } }]);

    // @deprecated This JWT proves nothing on its own (see OtpJwtStrategy) - it's
    // only issued so pre-existing clients that still send it back as the `otp`
    // header on /verify-reset keep working. Remove once such clients are no
    // longer supported; what actually authorizes /verify-reset is the email+code
    // pair, not this token.
    const token = this.getOtpToken(
      { email: user.email, verified: false },
      this.configService.get<number>('OTP_EXPIRATION'),
    );
    return { token };
  }

  /**
   * Verify the OTP for the given user and, if correct, return a JWT proving so.
   *
   * @deprecated The `user` param is only populated by the deprecated
   * OtpJwtStrategy/`otp` header (see there). Once that's removed, this should go
   * back to taking `(email, token)` directly from the request body.
   */
  async verifyOtp(user: User, { token }: OtpDto): Promise<{ token: string }> {
    const email = user.email;
    const windowSeconds = this.getOtpWindowSeconds();
    const tokenHash = this.hashOtp(token);

    // Atomically checks-and-deletes so the same code can never be redeemed twice,
    // even by two requests racing each other.
    const matched = await this.otpStoreService.consumeCodeHashIfMatch(email, tokenHash);
    if (secret === null) {
      throw new UnauthorizedException('No secret found');
    }

    if (!matched) {
      const attempts = await this.otpStoreService.registerFailedAttempt(email, windowSeconds);

      if (attempts >= this.getOtpMaxAttempts()) {
        // Burn the pending code outright so a locked-out attacker can't keep
        // guessing against it - the user has to request a brand new one. This is
        // a plain delete, not a time-based marker, so re-running it on every
        // subsequent guess is harmless (deleting an already-deleted key is a
        // no-op) and it can never collide with a code requested afterwards.
        await this.otpStoreService.deleteCodeHash(email);
        // This is a lockout, not a bad-credentials rejection - 429, matching how
        // every other rate-limit/lockout condition in this app is reported (see
        // EmailThrottlerGuard, IpUniqueEmailGuard), not 401.
        throw new HttpException(
          'Too many attempts. Please request a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Incorrect token');
    }

    // The code is already consumed at this point and stays that way even if
    // what follows fails - updateUser failing here should be rare (a single
    // status field), and it's simpler and safer to make the user request a
    // fresh code than to try to put this one back and risk racing a newer
    // code a concurrent /reset-password call may have stored in the meantime.
    try {
      await this.usersService.updateUser(user, { status: UserStatus.NEW });
    } catch {
      throw new InternalServerErrorException(
        'Error while updating user status. Please request a new code and try again.',
      );
    }

    await this.otpStoreService.resetFailedAttempts(email);

    // This JWT is the only thing proving the OTP was solved - it's what gates
    // /set-password, so it gets its own, more generous expiration, independent
    // of the short OTP guessing window above.
    const verifiedToken = this.getOtpToken(
      { email, verified: true },
      this.getOtpVerifiedExpirationMinutes(),
    );
    return { token: verifiedToken };
  }

  /* Prefer the configured APP_URL for the base URL embedded in outbound emails.
   * `fallbackUrl` - derived by the controller from the client-controlled `Host`
   * header (@deprecated, see AuthController) - is only used until APP_URL is
   * set on every deployment (#3332). */
  private resolveServerUrl(fallbackUrl: string): string {
    return this.configService.get<string>('APP_URL') || fallbackUrl;
  }

  /* A random numeric code, zero-padded to a fixed width - crypto.randomInt is
   * CSPRNG-backed and bias-free for a bounded range, unlike Math.random(). */
  private generateOtp(): string {
    return randomInt(0, OTP_MAX_VALUE).toString().padStart(OTP_DIGITS, '0');
  }

  /* Only the hash is ever persisted - never the raw code. Keyed with
   * OTP_HASH_SECRET (HMAC, not plain SHA-256) so that leaking the stored hash
   * alone - e.g. a Redis backup or misconfigured ACL - isn't enough to recover
   * the code: an 8-digit space is trivially brute-forced offline against an
   * unkeyed hash, but not without also knowing the secret. */
  private hashOtp(otp: string): Buffer {
    return createHmac('sha256', this.configService.getOrThrow<string>('OTP_HASH_SECRET'))
      .update(otp)
      .digest();
  }

  /* How long a generated code stays valid, in seconds. Also used as the TTL for
   * the failed-attempt counter, since it doesn't need to outlive the code it's
   * protecting. */
  private getOtpWindowSeconds(): number {
    return this.configService.get<number>('OTP_EXPIRATION') * 60;
  }

  private getOtpMaxAttempts(): number {
    return this.configService.get<number>('OTP_MAX_ATTEMPTS');
  }

  /* How long the verified OTP JWT stays valid, in minutes. Independent of the
   * guessing window above - by this point the code is already spent, so this is
   * just giving the user reasonable time to submit their new password. */
  private getOtpVerifiedExpirationMinutes(): number {
    return this.configService.get<number>('OTP_VERIFIED_EXPIRATION');
  }

  /* Sets the OTP jwt */
  private getOtpToken(otpPayload: OtpPayload, expiresInMinutes: number) {
    return this.jwtService.sign(otpPayload, {
      expiresIn: `${expiresInMinutes}m`,
    });
  }

  /* Set the password for verified user. */
  async setPassword(user: User, newPassword: string): Promise<void> {
    await this.usersService.setPassword(user, newPassword);
  }

  /* Generate a random password */
  private generatePassword() {
    const getRandomLetters = (length: number) =>
      Array.from({ length }, () => String.fromCharCode(97 + randomInt(26))).join('');

    return `${getRandomLetters(5)}-${getRandomLetters(5)}`;
  }

  /* Attempt to authenticate the token. */
  async authenticateWebsocketToken(accessToken: string): Promise<User> {
    const { userId } = await this.jwtService.verifyAsync(accessToken);
    const result = await this.usersService.getUser({ id: userId });
    if (result !== null) {
      return result;
    } else {
      throw new UnauthorizedException('Cannot find user matching access token');
    }
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
