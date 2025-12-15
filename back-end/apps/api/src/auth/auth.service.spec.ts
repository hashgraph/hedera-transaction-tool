import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { mock } from 'jest-mock-extended';

import { AuthService } from './auth.service';

import * as bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';
import { ErrorCodes, NatsPublisherService } from '@app/common';
import { User, UserStatus } from '@entities';
import { totp } from 'otplib';
import { UsersService } from '../users/users.service';
import { SignUpUserDto } from './dtos';

jest.mock('bcryptjs');
jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;

  const userService = mock<UsersService>();
  const configService = mock<ConfigService>();
  const jwtService = mock<JwtService>();
  const notificationsPublisher = mock<NatsPublisherService>();

  beforeEach(async () => {
    jest.resetAllMocks();

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
      ],
    }).compile();

    service = module.get(AuthService);
  });

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
    const user = { email };
    const otpSecret = 'my-cool-secret';
    const totpRes = '123456';
    const accessToken = 'token';

    userService.getUser.mockResolvedValue(user as User);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_SECRET')
      .mockReturnValue(otpSecret);

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('NODE_ENV')
      .mockReturnValue(production ? 'production' : 'development');

    jwtService.sign.mockReturnValue('token');

    jest.spyOn(totp, 'generate').mockReturnValue(totpRes);

    await service.createOtp(email);

    return { user, otpSecret, totpRes, accessToken };
  }

  async function invokeVerifyOtp(production: boolean) {
    const email = 'email';
    const user = { email };
    const otpSecret = 'secret';
    const accessToken = 'token';

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_SECRET')
      .mockReturnValue(otpSecret);
    jwtService.sign.mockReturnValue(accessToken);

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('NODE_ENV')
      .mockReturnValue(production ? 'production' : 'development');
    jest.spyOn(totp, 'check').mockReturnValue(true);

    await service.verifyOtp(user as User, { token: '123456' });

    return { user, otpSecret, accessToken };
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
    const { user, otpSecret, totpRes } = await invokeCreateOtp(false);

    expect(totp.generate).toHaveBeenCalledWith(`${otpSecret}${user.email}`);
    expect(notificationsPublisher.publish).toHaveBeenCalledWith('notifications.queue.email.password-reset', [{
      email: user.email,
      additionalData: { otp: totpRes },
    }]);
  });

  it('should create otp in production', async () => {
    const { user, otpSecret, totpRes } = await invokeCreateOtp(true);

    expect(totp.generate).toHaveBeenCalledWith(`${otpSecret}${user.email}`);
    expect(notificationsPublisher.publish).toHaveBeenCalledWith('notifications.queue.email.password-reset', [{
      email: user.email,
      additionalData: { otp: totpRes },
    }]);
  });

  it('should not create otp if user not found', async () => {
    const email = '';

    userService.getUser.mockResolvedValue(null);

    await service.createOtp(email);
  });

  it('should verify otp in dev', async () => {
    const { user } = await invokeVerifyOtp(false);

    expect(userService.updateUser).toHaveBeenCalledWith(user, { status: UserStatus.NEW });
  });

  it('should verify otp in production', async () => {
    const { user } = await invokeVerifyOtp(true);

    expect(userService.updateUser).toHaveBeenCalledWith(user, { status: UserStatus.NEW });
  });

  it('should throw error if token is invalid', async () => {
    const email = 'email';
    const user = { email };

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_SECRET')
      .mockReturnValue('');

    jest.spyOn(totp, 'check').mockReturnValue(false);

    await expect(service.verifyOtp(user as User, { token: '123456' })).rejects.toThrow(
      'Incorrect token',
    );
  });

  it('should throw error if update user fails', async () => {
    const email = 'email';
    const user = { email };

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_SECRET')
      .mockReturnValue('');

    jest.spyOn(totp, 'check').mockReturnValue(true);
    userService.updateUser.mockRejectedValue(new Error());

    await expect(service.verifyOtp(user as User, { token: '123456' })).rejects.toThrow(
      'Error while updating user status',
    );
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
