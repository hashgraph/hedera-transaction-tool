import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt } from 'crypto';

import { mock } from 'jest-mock-extended';

import { AuthService } from './auth.service';

import * as bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';
import { ErrorCodes, NatsPublisherService } from '@app/common';
import { User, UserStatus } from '@entities';
import { UsersService } from '../users/users.service';
import { OtpStoreService } from './otp-store.service';
import { SignUpUserDto } from './dtos';

jest.mock('bcryptjs');
jest.mock('argon2');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomInt: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const userService = mock<UsersService>();
  const configService = mock<ConfigService>();
  const jwtService = mock<JwtService>();
  const notificationsPublisher = mock<NatsPublisherService>();
  const otpStoreService = mock<OtpStoreService>();

  const OTP_HASH_SECRET = 'test-otp-hash-secret';

  beforeEach(async () => {
    jest.resetAllMocks();

    //@ts-expect-error - incorrect overload expected
    configService.getOrThrow.calledWith('OTP_HASH_SECRET').mockReturnValue(OTP_HASH_SECRET);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: userService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: NatsPublisherService,
          useValue: notificationsPublisher,
        },
        {
          provide: OtpStoreService,
          useValue: otpStoreService,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  function hashOf(otp: string): Buffer {
    return createHmac('sha256', OTP_HASH_SECRET).update(otp).digest();
  }

  async function invokeLogin(production: boolean) {
    const user = { id: 1, email: '' };
    const JWT_EXPIRATION = 2;

    //@ts-expect-error - incorrect overload expected
    configService.get.calledWith('JWT_EXPIRATION').mockReturnValue(JWT_EXPIRATION);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('NODE_ENV')
      .mockReturnValue(production ? 'production' : 'development');
    jest.spyOn(jwtService, 'sign').mockReturnValue('token');

    await service.login(user as User);

    return { user };
  }

  async function invokeCreateOtp(production: boolean) {
    const email = 'some@email.com';
    const serverUrl = 'https://tool.example.com';
    const user = { email };
    const otp = '00001234';

    userService.getUser.mockResolvedValue(user as User);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_EXPIRATION')
      .mockReturnValue(2);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('NODE_ENV')
      .mockReturnValue(production ? 'production' : 'development');
    jwtService.sign.mockReturnValue('unverifiedToken');

    //@ts-expect-error - incorrect overload expected
    jest.mocked(randomInt).mockReturnValue(1234);

    const result = await service.createOtp(email, serverUrl);

    return { user, otp, serverUrl, result };
  }

  async function invokeVerifyOtp(production: boolean) {
    const email = 'email';
    const user = { email };
    const otp = '12345678';
    const accessToken = 'token';

    otpStoreService.consumeCodeHashIfMatch.mockResolvedValue(true);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_EXPIRATION')
      .mockReturnValue(2);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_VERIFIED_EXPIRATION')
      .mockReturnValue(5);
    jwtService.sign.mockReturnValue(accessToken);

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('NODE_ENV')
      .mockReturnValue(production ? 'production' : 'development');

    await service.verifyOtp(user as User, { token: otp });

    return { user, otp, accessToken };
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should sign up user and notify by email', async () => {
    const dto: SignUpUserDto = { email: 'test@email.com' };

    jest.spyOn(userService, 'createUser').mockResolvedValue({ id: 1, email: dto.email } as User);

    await service.signUpByAdmin(dto, 'http://localhost');

    expect(userService.createUser).toHaveBeenCalledWith(dto.email, expect.any(String));
    expect(notificationsPublisher.publish).toHaveBeenCalledWith(
      'notifications.queue.email.invite',
      expect.arrayContaining([
        expect.objectContaining({
          email: dto.email,
          additionalData: expect.objectContaining({
            tempPassword: expect.any(String),
            url: expect.any(String),
          }),
        }),
      ]),
    );
  });

  it('should use FRONTEND_REPO_URL when building the download URL', async () => {
    const dto: SignUpUserDto = { email: 'test@email.com' };

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('FRONTEND_REPO_URL')
      .mockReturnValue('https://example.com/releases/');

    jest.spyOn(userService, 'createUser').mockResolvedValue({ id: 1, email: dto.email } as User);

    await service.signUpByAdmin(dto, 'http://localhost');

    expect(notificationsPublisher.publish).toHaveBeenCalledWith(
      'notifications.queue.email.invite',
      expect.arrayContaining([
        expect.objectContaining({
          additionalData: expect.objectContaining({
            downloadUrl: 'https://example.com/releases/latest',
          }),
        }),
      ]),
    );
  });

  it('should prefer APP_URL over the Host-header-derived fallback URL', async () => {
    const dto: SignUpUserDto = { email: 'test@email.com' };

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('APP_URL')
      .mockReturnValue('https://tool.example.com');

    jest.spyOn(userService, 'createUser').mockResolvedValue({ id: 1, email: dto.email } as User);

    await service.signUpByAdmin(dto, 'http://localhost');

    expect(notificationsPublisher.publish).toHaveBeenCalledWith(
      'notifications.queue.email.invite',
      expect.arrayContaining([
        expect.objectContaining({
          additionalData: expect.objectContaining({ url: 'https://tool.example.com' }),
        }),
      ]),
    );
  });

  it('should fall back to the Host-header-derived URL when APP_URL is not set', async () => {
    const dto: SignUpUserDto = { email: 'test@email.com' };

    jest.spyOn(userService, 'createUser').mockResolvedValue({ id: 1, email: dto.email } as User);

    await service.signUpByAdmin(dto, 'http://localhost');

    expect(notificationsPublisher.publish).toHaveBeenCalledWith(
      'notifications.queue.email.invite',
      expect.arrayContaining([
        expect.objectContaining({
          additionalData: expect.objectContaining({ url: 'http://localhost' }),
        }),
      ]),
    );
  });

  it('should update the password and resend an email for an existing user with status NEW', async () => {
    const dto: SignUpUserDto = { email: 'test@test.com' };

    jest.spyOn(userService, 'getUser').mockResolvedValue({
      id: 1,
      email: dto.email,
      status: UserStatus.NEW,
      deletedAt: null,
    } as User);

    jest.spyOn(userService, 'getSaltedHash').mockResolvedValue('hashedPassword');

    jest.spyOn(userService, 'updateUserById').mockResolvedValue({
      id: 1,
      email: dto.email,
      status: UserStatus.NEW,
      password: 'hashedPassword',
    } as User);

    await service.signUpByAdmin(dto, 'http://localhost');

    expect(userService.getUser).toHaveBeenCalledWith({ email: dto.email }, true);

    expect(userService.getSaltedHash).toHaveBeenCalledWith(expect.any(String));

    expect(userService.updateUserById).toHaveBeenCalledWith(1, { password: 'hashedPassword' });

    expect(notificationsPublisher.publish).toHaveBeenCalledWith(
      'notifications.queue.email.invite',
      expect.arrayContaining([
        expect.objectContaining({
          email: dto.email,
          additionalData: expect.objectContaining({
            tempPassword: expect.any(String),
            url: expect.any(String),
          }),
        }),
      ]),
    );
  });

  it('should login user', async () => {
    const { user } = await invokeLogin(false);

    expect(jwtService.sign).toHaveBeenCalledWith(
      { userId: user.id, email: user.email },
      expect.any(Object),
    );
  });

  it('should change password', async () => {
    const user = { id: 1, email: '', password: 'old' };
    const dto = { oldPassword: 'old', newPassword: 'new' };

    //@ts-expect-error - incorrect overload expected
    jest.mocked(bcrypt.compare).mockResolvedValue(true);
    jest.mocked(argon2.verify).mockResolvedValue(false);
    jest.spyOn(service, 'dualCompareHash').mockResolvedValueOnce({ correct: true, isBcrypt: true });

    await service.changePassword(user as User, dto);

    expect(userService.setPassword).toHaveBeenCalledWith(user, dto.newPassword);
  });

  it('should not change password if old and new are the same', async () => {
    const user = { id: 1, email: '', password: 'old' };
    const dto = { oldPassword: 'old', newPassword: 'old' };

    await expect(service.changePassword(user as User, dto)).rejects.toThrow(ErrorCodes.NPMOP);
  });

  it('should not change password if old password is invalid', async () => {
    const user = { id: 1, email: '', password: 'old' };
    const dto = { oldPassword: 'old', newPassword: 'new' };

    //@ts-expect-error - incorrect overload expected
    jest.mocked(bcrypt.compare).mockResolvedValue(false);
    jest.mocked(argon2.verify).mockResolvedValue(false);

    await expect(service.changePassword(user as User, dto)).rejects.toThrow(ErrorCodes.INOP);
  });

  it('should emit user registered notification for admins', async () => {
    const user = { id: 1, email: '', status: UserStatus.NEW, keys: [] };

    //@ts-expect-error - incorrect overload expected
    jest.mocked(bcrypt.compare).mockResolvedValue(true);
    jest.mocked(argon2.verify).mockResolvedValue(true);

    jest.spyOn(userService, 'getAdmins').mockResolvedValue([{ id: 2 }] as User[]);

    await service.changePassword(user as User, { oldPassword: '', newPassword: 'new' });

    expect(notificationsPublisher.publish).toHaveBeenCalledWith('notifications.queue.user.registered', {
      entityId: user.id,
      additionalData: { username: user.email },
    });
  });

  it('should create otp in dev', async () => {
    const { user, otp, serverUrl, result } = await invokeCreateOtp(false);

    expect(notificationsPublisher.publish).toHaveBeenCalledWith(
      'notifications.queue.email.password-reset',
      [
        {
          email: user.email,
          additionalData: { otp, serverUrl },
        },
      ],
    );
    expect(otpStoreService.resetFailedAttempts).toHaveBeenCalledWith(user.email);
    expect(otpStoreService.storeCodeHash).toHaveBeenCalledWith(user.email, hashOf(otp), 120);
    // Deprecated unverified JWT, kept only for pre-existing clients (see OtpJwtStrategy).
    expect(result).toEqual({ token: 'unverifiedToken' });
    expect(jwtService.sign).toHaveBeenCalledWith({ email: user.email, verified: false }, { expiresIn: '2m' });
  });

  it('should create otp in production', async () => {
    const { user, otp, serverUrl } = await invokeCreateOtp(true);

    expect(notificationsPublisher.publish).toHaveBeenCalledWith(
      'notifications.queue.email.password-reset',
      [
        {
          email: user.email,
          additionalData: { otp, serverUrl },
        },
      ],
    );
  });

  it('should prefer APP_URL over the Host-header-derived fallback URL', async () => {
    const email = 'some@email.com';
    const user = { email };

    userService.getUser.mockResolvedValue(user as User);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('APP_URL')
      .mockReturnValue('https://tool.example.com');
    //@ts-expect-error - incorrect overload expected
    jest.mocked(randomInt).mockReturnValue(1234);

    await service.createOtp(email, 'http://localhost');

    expect(notificationsPublisher.publish).toHaveBeenCalledWith(
      'notifications.queue.email.password-reset',
      [
        expect.objectContaining({
          additionalData: expect.objectContaining({ serverUrl: 'https://tool.example.com' }),
        }),
      ],
    );
  });

  it('should never store the plaintext otp, only its hash', async () => {
    const { otp } = await invokeCreateOtp(false);

    expect(otpStoreService.storeCodeHash).not.toHaveBeenCalledWith(
      expect.any(String),
      otp,
      expect.any(Number),
    );
    expect(otpStoreService.storeCodeHash).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      expect.any(Number),
    );
  });

  it('should not create otp if user not found', async () => {
    const email = '';

    userService.getUser.mockResolvedValue(null);

    await service.createOtp(email, 'https://tool.example.com');

    expect(otpStoreService.resetFailedAttempts).not.toHaveBeenCalled();
    expect(otpStoreService.storeCodeHash).not.toHaveBeenCalled();
  });

  it('should verify otp in dev', async () => {
    const { user } = await invokeVerifyOtp(false);

    expect(userService.updateUser).toHaveBeenCalledWith(user, { status: UserStatus.NEW });
  });

  it('should verify otp in production', async () => {
    const { user } = await invokeVerifyOtp(true);

    expect(userService.updateUser).toHaveBeenCalledWith(user, { status: UserStatus.NEW });
  });

  it("should sign the verified jwt with the verified expiration, not the guessing window's", async () => {
    await invokeVerifyOtp(false);

    expect(jwtService.sign).toHaveBeenCalledWith(
      { email: 'email', verified: true },
      { expiresIn: '5m' },
    );
  });

  it('should consume the code atomically and clear attempts on success', async () => {
    const { user, otp } = await invokeVerifyOtp(false);

    expect(otpStoreService.consumeCodeHashIfMatch).toHaveBeenCalledWith(user.email, hashOf(otp));
    expect(otpStoreService.resetFailedAttempts).toHaveBeenCalledWith(user.email);
  });

  it('should throw error if token is invalid', async () => {
    const email = 'email';
    const user = { email };

    otpStoreService.consumeCodeHashIfMatch.mockResolvedValue(false);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_EXPIRATION')
      .mockReturnValue(2);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_MAX_ATTEMPTS')
      .mockReturnValue(3);

    otpStoreService.registerFailedAttempt.mockResolvedValue(1);

    await expect(service.verifyOtp(user as User, { token: '12345678' })).rejects.toThrow(
      'Incorrect token',
    );
    expect(otpStoreService.registerFailedAttempt).toHaveBeenCalledWith(email, 120);
    expect(otpStoreService.deleteCodeHash).not.toHaveBeenCalled();
  });

  it('should lock out and delete the pending code after too many failed attempts', async () => {
    const email = 'email';
    const user = { email };

    otpStoreService.consumeCodeHashIfMatch.mockResolvedValue(false);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_EXPIRATION')
      .mockReturnValue(2);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_MAX_ATTEMPTS')
      .mockReturnValue(3);

    otpStoreService.registerFailedAttempt.mockResolvedValue(3);

    await expect(service.verifyOtp(user as User, { token: '12345678' })).rejects.toThrow(
      'Too many attempts. Please request a new code.',
    );
    expect(otpStoreService.deleteCodeHash).toHaveBeenCalledWith(email);
  });

  it('should keep deleting (a harmless no-op) on guesses after lockout, unlike a time-based burn', async () => {
    const email = 'email';
    const user = { email };

    otpStoreService.consumeCodeHashIfMatch.mockResolvedValue(false);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_EXPIRATION')
      .mockReturnValue(2);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_MAX_ATTEMPTS')
      .mockReturnValue(3);

    // e.g. the attacker's 5th guess, well past the threshold.
    otpStoreService.registerFailedAttempt.mockResolvedValue(5);

    await expect(service.verifyOtp(user as User, { token: '12345678' })).rejects.toThrow(
      'Too many attempts. Please request a new code.',
    );
    // Deleting an already-deleted key is a no-op, so unlike the old time-step burn
    // there's no need to guard against re-triggering this on every later guess -
    // it can never invalidate a code requested afterwards.
    expect(otpStoreService.deleteCodeHash).toHaveBeenCalledWith(email);
  });

  it('should not consume the code twice even if two requests race - modeled by consumeCodeHashIfMatch being atomic', async () => {
    const email = 'email';
    const user = { email };

    // The store's atomic script is what actually prevents the race - this just
    // confirms the service relies on its result rather than a separate read.
    otpStoreService.consumeCodeHashIfMatch.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_EXPIRATION')
      .mockReturnValue(2);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_VERIFIED_EXPIRATION')
      .mockReturnValue(5);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_MAX_ATTEMPTS')
      .mockReturnValue(3);
    otpStoreService.registerFailedAttempt.mockResolvedValue(1);

    const [first, second] = await Promise.allSettled([
      service.verifyOtp(user as User, { token: '12345678' }),
      service.verifyOtp(user as User, { token: '12345678' }),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
  });

  it('should throw error if update user fails, leaving the already-consumed code burned', async () => {
    const email = 'email';
    const user = { email };
    const otp = '12345678';

    otpStoreService.consumeCodeHashIfMatch.mockResolvedValue(true);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_EXPIRATION')
      .mockReturnValue(2);

    userService.updateUser.mockRejectedValue(new Error());

    await expect(service.verifyOtp(user as User, { token: otp })).rejects.toThrow(
      'Error while updating user status',
    );
    expect(otpStoreService.resetFailedAttempts).not.toHaveBeenCalled();
  });

  it('should set password', async () => {
    const user = { id: 1, email: '' };
    const newPassword = 'new';

    await service.setPassword(user as User, newPassword);

    expect(userService.setPassword).toHaveBeenCalledWith(user, newPassword);
  });

  it('should authenticate access token', async () => {
    const token = 'token';

    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ userId: '2' });

    await service.authenticateWebsocketToken(token);

    expect(userService.getUser).toHaveBeenCalledWith({ id: '2' });
  });

  it('should elevate user to admin', async () => {
    const dto = { id: 1 };

    await service.elevateAdmin(dto.id);

    expect(userService.updateUserById).toHaveBeenCalledWith(dto.id, { admin: true });
  });
});
