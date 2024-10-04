import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { mock } from 'jest-mock-extended';

import { AuthService } from './auth.service';

import { Response } from 'express';
import { NOTIFICATIONS_SERVICE } from '@app/common';
import { User, UserStatus } from '@entities';
import * as bcrypt from 'bcryptjs';
import { totp } from 'otplib';
import { UsersService } from '../users/users.service';
import { SignUpUserDto } from './dtos';

describe('AuthService', () => {
  let service: AuthService;

  const userService = mock<UsersService>();
  const configService = mock<ConfigService>();
  const jwtService = mock<JwtService>();
  const notificationsService = mock<ClientProxy>();

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
          provide: NOTIFICATIONS_SERVICE,
          useValue: notificationsService,
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  async function invokeLogin(production: boolean) {
    const user = { id: 1, email: '' };
    const response: Partial<Response> = { cookie: jest.fn() };
    const JWT_EXPIRATION = 2;

    //@ts-expect-error - incorrect overload expected
    configService.get.calledWith('JWT_EXPIRATION').mockReturnValue(JWT_EXPIRATION);
    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('NODE_ENV')
      .mockReturnValue(production ? 'production' : 'development');
    jest.spyOn(jwtService, 'sign').mockReturnValue('token');

    await service.login(user as User, response as Response);

    return { user, response };
  }

  async function invokeLogout(production: boolean) {
    const response: Partial<Response> = { clearCookie: jest.fn() };

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('NODE_ENV')
      .mockReturnValue(production ? 'production' : 'development');

    await service.logout(response as Response);

    return response;
  }

  async function invokeCreateOtp(production: boolean) {
    const email = 'some@email.com';
    const user = { email };
    const otpSecret = 'my-cool-secret';
    const totpRes = '123456';
    const accessToken = 'token';
    const response: Partial<Response> = { cookie: jest.fn() };

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

    await service.createOtp(email, response as Response);

    return { user, otpSecret, totpRes, accessToken, response };
  }

  async function invokeVerifyOtp(production: boolean) {
    const email = 'email';
    const user = { email };
    const otpSecret = 'secret';
    const accessToken = 'token';
    const response: Partial<Response> = { cookie: jest.fn() };

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

    await service.verifyOtp(user as User, { token: '123456' }, response as Response);

    return { user, response, otpSecret, accessToken };
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should sign up user and notify by email', async () => {
    const dto: SignUpUserDto = { email: 'test@email.com' };

    jest.spyOn(userService, 'createUser').mockResolvedValue({ id: 1, email: dto.email } as User);

    await service.signUpByAdmin(dto, 'http://localhost');

    expect(userService.createUser).toHaveBeenCalledWith(dto.email, expect.any(String));
    expect(notificationsService.emit).toHaveBeenCalledWith(
      'notify_email',
      expect.objectContaining({ email: dto.email }),
    );
  });

  it('should login user and set cookie in dev', async () => {
    const { user, response } = await invokeLogin(false);

    expect(jwtService.sign).toHaveBeenCalledWith(
      { userId: user.id, email: user.email },
      expect.any(Object),
    );

    expect(response.cookie).toHaveBeenCalledWith('Authentication', expect.any(String), {
      httpOnly: true,
      expires: expect.any(Date),
      sameSite: 'lax',
      secure: false,
    });
  });

  it('should login user and set cookie in production', async () => {
    const { user, response } = await invokeLogin(true);

    expect(jwtService.sign).toHaveBeenCalledWith(
      { userId: user.id, email: user.email },
      expect.any(Object),
    );

    expect(response.cookie).toHaveBeenCalledWith('Authentication', expect.any(String), {
      httpOnly: true,
      expires: expect.any(Date),
      sameSite: 'none',
      secure: true,
    });
  });

  it('should logout user and clear cookie in dev', async () => {
    const response = await invokeLogout(false);

    expect(response.clearCookie).toHaveBeenCalledWith('Authentication', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
  });

  it('should logout user and clear cookie in production', async () => {
    const response = await invokeLogout(true);

    expect(response.clearCookie).toHaveBeenCalledWith('Authentication', {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });
  });

  it('should change password', async () => {
    const user = { id: 1, email: '', password: 'old' };
    const dto = { oldPassword: 'old', newPassword: 'new' };

    jest.spyOn(bcrypt, 'compare').mockImplementationOnce(async () => true);

    await service.changePassword(user as User, dto);

    expect(userService.setPassword).toHaveBeenCalledWith(user, dto.newPassword);
  });

  it('should not change password if old and new are the same', async () => {
    const user = { id: 1, email: '', password: 'old' };
    const dto = { oldPassword: 'old', newPassword: 'old' };

    await expect(service.changePassword(user as User, dto)).rejects.toThrow(
      'New password should not be the old password',
    );
  });

  it('should not change password if old password is invalid', async () => {
    const user = { id: 1, email: '', password: 'old' };
    const dto = { oldPassword: 'old', newPassword: 'new' };

    jest.spyOn(bcrypt, 'compare').mockImplementationOnce(async () => false);

    await expect(service.changePassword(user as User, dto)).rejects.toThrow('Invalid old password');
  });

  it('should create otp in dev', async () => {
    const { user, otpSecret, totpRes, accessToken, response } = await invokeCreateOtp(false);

    expect(totp.generate).toHaveBeenCalledWith(`${otpSecret}${user.email}`);
    expect(notificationsService.emit).toHaveBeenCalledWith('notify_email', {
      email: user.email,
      subject: 'Password Reset token',
      text: expect.stringContaining(totpRes),
    });
    expect(response.cookie).toHaveBeenCalledWith('otp', accessToken, {
      httpOnly: true,
      expires: expect.any(Date),
      sameSite: 'lax',
      secure: false,
    });
  });

  it('should create otp in production', async () => {
    const { user, otpSecret, totpRes, accessToken, response } = await invokeCreateOtp(true);

    expect(totp.generate).toHaveBeenCalledWith(`${otpSecret}${user.email}`);
    expect(notificationsService.emit).toHaveBeenCalledWith('notify_email', {
      email: user.email,
      subject: 'Password Reset token',
      text: expect.stringContaining(totpRes),
    });
    expect(response.cookie).toHaveBeenCalledWith('otp', accessToken, {
      httpOnly: true,
      expires: expect.any(Date),
      sameSite: 'none',
      secure: true,
    });
  });

  it('should not create otp if user not found', async () => {
    const email = '';

    userService.getUser.mockResolvedValue(null);

    await service.createOtp(email, {} as Response);
  });

  it('should verify otp in dev', async () => {
    const { user, accessToken, response } = await invokeVerifyOtp(false);

    expect(userService.updateUser).toHaveBeenCalledWith(user, { status: UserStatus.NEW });
    expect(response.cookie).toHaveBeenCalledWith('otp', accessToken, {
      httpOnly: true,
      expires: expect.any(Date),
      sameSite: 'lax',
      secure: false,
    });
  });

  it('should verify otp in production', async () => {
    const { user, accessToken, response } = await invokeVerifyOtp(true);

    expect(userService.updateUser).toHaveBeenCalledWith(user, { status: UserStatus.NEW });
    expect(response.cookie).toHaveBeenCalledWith('otp', accessToken, {
      httpOnly: true,
      expires: expect.any(Date),
      sameSite: 'none',
      secure: true,
    });
  });

  it('should throw error if token is invalid', async () => {
    const email = 'email';
    const user = { email };

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('OTP_SECRET')
      .mockReturnValue('');

    jest.spyOn(totp, 'check').mockReturnValue(false);

    await expect(
      service.verifyOtp(user as User, { token: '123456' }, {} as Response),
    ).rejects.toThrow('Incorrect token');
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

    await expect(
      service.verifyOtp(user as User, { token: '123456' }, {} as Response),
    ).rejects.toThrow('Error while updating user status');
  });

  it('should clear otp cookie in dev', () => {
    const response: Partial<Response> = { clearCookie: jest.fn() };

    service.clearOtpCookie(response as Response);

    expect(response.clearCookie).toHaveBeenCalledWith('otp', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    });
  });

  it('should clear otp cookie in production', () => {
    const response: Partial<Response> = { clearCookie: jest.fn() };

    configService.get
      //@ts-expect-error - incorrect overload expected
      .calledWith('NODE_ENV')
      .mockReturnValue('production');

    service.clearOtpCookie(response as Response);

    expect(response.clearCookie).toHaveBeenCalledWith('otp', {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });
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
});
