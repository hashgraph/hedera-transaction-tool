import { Body, Controller, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SkipThrottle } from '@nestjs/throttler';

import { Request } from 'express';

import { BlacklistService, Serialize } from '@app/common';

import { User } from '@entities';

import {
  AdminGuard,
  EmailThrottlerGuard,
  extractJwtAuth,
  extractJwtOtp,
  IpLoginThrottlerGuard,
  IpResetPasswordThrottlerGuard,
  IpUniqueEmailGuard,
  JwtAuthGuard,
  JwtBlackListAuthGuard,
  JwtBlackListOtpGuard,
  LocalAuthGuard,
  OtpJwtAuthGuard,
  OtpVerifiedAuthGuard,
} from '../guards';

import { GetUser } from '../decorators';

import { AuthService } from './auth.service';

import {
  AuthDto,
  AuthenticateWebsocketTokenDto,
  ChangePasswordDto,
  ElevateAdminDto,
  LoginDto,
  LoginResponseDto,
  NewPasswordDto,
  OtpDto,
  OtpLocalDto,
  SignUpUserDto,
} from './dtos';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly blacklistService: BlacklistService,
  ) {}

  /* Register new users by admins */
  @ApiOperation({
    summary: 'Create a new User',
    description:
      "Admins can create a new user by providing an email for the user. The password will be generated and sent to the user's email.",
  })
  @ApiResponse({
    status: 201,
    type: AuthDto,
  })
  @Post('/signup')
  @Serialize(AuthDto)
  @UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, AdminGuard, EmailThrottlerGuard)
  async signUp(@Body() dto: SignUpUserDto, @Req() req: Request): Promise<User> {
    const url = `${req.protocol}://${req.get('host')}`;
    return this.authService.signUpByAdmin(dto, url);
  }

  /* User login */
  @ApiOperation({
    summary: 'Login in',
    description: 'Using the provided credentials, attempt to log the user into the organization.',
  })
  @ApiBody({
    type: LoginDto,
  })
  @ApiResponse({
    status: 200,
    type: LoginResponseDto,
    description: 'User is verified and an authentication token is returned along with the user.',
  })
  @Post('/login')
  @HttpCode(200)
  @UseGuards(EmailThrottlerGuard, IpLoginThrottlerGuard, LocalAuthGuard)
  @Serialize(LoginResponseDto)
  async login(@GetUser() user: User) {
    const accessToken = await this.authService.login(user);
    return { user, accessToken };
  }

  /* User log out */
  @ApiOperation({
    summary: 'Log out',
    description: 'Log the user out of the organization.',
  })
  @ApiResponse({
    status: 200,
    description: "The user's authentication token is added in the blacklist.",
  })
  @Post('/logout')
  @HttpCode(200)
  @UseGuards(JwtBlackListAuthGuard, JwtAuthGuard)
  async logout(@Req() req: Request) {
    await this.blacklistService.blacklistToken(extractJwtAuth(req));
  }

  /* Change user's password */
  @ApiOperation({
    summary: 'Change password',
    description: 'Change the password of the current logged in user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password successfully changed.',
  })
  @Patch('/change-password')
  @UseGuards(JwtBlackListAuthGuard, JwtAuthGuard)
  async changePassword(@GetUser() user: User, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.authService.changePassword(user, dto);
  }

  /* Send OTP to verify password reset */
  @ApiOperation({
    summary: 'Request OTP for password reset',
    description:
      "Begin the process of resetting the user's password by creating and emailing an OTP to the user. A JWT is returned; it carries no real authorization on its own and is kept only for backward compatibility with clients that still expect one (see the deprecation note on OtpJwtStrategy) - what actually matters is the email and OTP submitted together to /verify-reset.",
  })
  @ApiBody({
    type: OtpLocalDto,
  })
  @ApiResponse({
    status: 200,
    description: 'OTP created and sent, if the email belongs to a known user.',
  })
  @Post('/reset-password')
  @HttpCode(200)
  @UseGuards(EmailThrottlerGuard, IpResetPasswordThrottlerGuard, IpUniqueEmailGuard)
  async createOtp(@Body() { email }: OtpLocalDto) {
    return this.authService.createOtp(email);
  }

  /* Verify OTP for password reset */
  @ApiOperation({
    summary: 'Verify password reset',
    description:
      'Verify the user can reset the password by supplying the valid OTP alongside the `otp` JWT header issued by /reset-password. If the OTP is valid, a JWT is issued and the user will be able to set a new password. After too many incorrect attempts the OTP is invalidated and a new one must be requested via /reset-password.',
  })
  @ApiResponse({
    status: 200,
    description:
      'The OTP is verified and a JWT is issued. The user can now set a new password. If the JWT expires, or the OTP is invalidated after too many attempts, the user will need to request a new OTP.',
  })
  @Post('/verify-reset')
  @HttpCode(200)
  // IpResetPasswordThrottlerGuard is reused as-is here - its key includes the handler
  // name, so this tracks verify-reset attempts independently from reset-password ones,
  // under the same limits. IpUniqueEmailGuard needs req.user, which JwtBlackListOtpGuard/
  // OtpJwtAuthGuard populate - so those two run first. EmailThrottlerGuard is
  // deliberately not reused here: its per-email request-rate cap conflicts with
  // OTP_MAX_ATTEMPTS's own, more precise, per-email lockout (enforced in
  // AuthService.verifyOtp), which already covers this route's per-email abuse case
  // regardless of source IP. None of this depends on the OTP JWT being kept around:
  // once it's removed and the email moves into the request body directly,
  // IpUniqueEmailGuard keeps working unchanged.
  @UseGuards(IpResetPasswordThrottlerGuard, JwtBlackListOtpGuard, OtpJwtAuthGuard, IpUniqueEmailGuard)
  async verifyOtp(@GetUser() user: User, @Body() dto: OtpDto, @Req() req) {
    const result = await this.authService.verifyOtp(user, dto);
    await this.blacklistService.blacklistToken(extractJwtOtp(req));
    return result;
  }

  /* Set the password for the user if the email has been verified */
  @ApiOperation({
    summary: 'Set the password',
    description: 'Set the password for the verified email.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password successfully set.',
  })
  @UseGuards(JwtBlackListOtpGuard, OtpVerifiedAuthGuard)
  @Patch('/set-password')
  async setPassword(@GetUser() user: User, @Body() dto: NewPasswordDto, @Req() req): Promise<void> {
    await this.authService.setPassword(user, dto.password);
    await this.blacklistService.blacklistToken(extractJwtOtp(req));
  }

  /* Elevate other uses to admins */
  @ApiOperation({
    summary: 'Elevates users to admins',
    description:
      "Admins can elevate other users to admins. The user's id is provided and the user is elevated to admin.",
  })
  @ApiResponse({
    status: 200,
  })
  @Patch('/elevate-admin')
  @UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, AdminGuard)
  async elevateUser(@Body() dto: ElevateAdminDto): Promise<void> {
    return this.authService.elevateAdmin(dto.id);
  }

  @SkipThrottle()
  @MessagePattern('authenticate-websocket-token')
  @Serialize(AuthDto)
  async authenticateWebsocketToken(@Payload() payload: AuthenticateWebsocketTokenDto) {
    return this.authService.authenticateWebsocketToken(payload.jwt);
  }
}
