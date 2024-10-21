import { Body, Controller, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SkipThrottle } from '@nestjs/throttler';

import { Request, Response } from 'express';

import { Serialize } from '@app/common';

import { User } from '@entities';

import {
  AdminGuard,
  EmailThrottlerGuard,
  JwtAuthGuard,
  LocalAuthGuard,
  OtpJwtAuthGuard,
  OtpVerifiedAuthGuard,
} from '../guards';

import { GetUser } from '../decorators';

import { AuthService } from './auth.service';

import {
  AuthDto,
  ChangePasswordDto,
  LoginDto,
  NewPasswordDto,
  OtpDto,
  OtpLocalDto,
  SignUpUserDto,
  AuthenticateWebsocketTokenDto,
  LoginResponseDto,
} from './dtos';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  @UseGuards(JwtAuthGuard, AdminGuard, EmailThrottlerGuard)
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
    description: 'User is verified and an authentication token in a cookie is attached.',
  })
  @Post('/login')
  @HttpCode(200)
  @UseGuards(LocalAuthGuard, EmailThrottlerGuard)
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
    description: "The user's authentication token cookie is removed and added in the blacklist.",
  })
  @Post('/logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  logout(@Res({ passthrough: true }) response: Response) {
    return this.authService.logout(response);
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
  @UseGuards(JwtAuthGuard)
  async changePassword(@GetUser() user: User, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.authService.changePassword(user, dto);
  }

  /* Send OTP to verify password reset */
  @ApiOperation({
    summary: 'Request OTP for password reset',
    description:
      "Begin the process of resetting the user's password by creating and emailing an OTP to the user. A JWT cookie is attached to the response. Once the OTP is verified, the JWT cookie will be updated and the user will be able to set his new password.",
  })
  @ApiBody({
    type: SignUpUserDto,
  })
  @ApiResponse({
    status: 200,
    description: 'OTP created and sent.',
  })
  @Post('/reset-password')
  @HttpCode(200)
  @UseGuards(EmailThrottlerGuard)
  async createOtp(@Body() { email }: OtpLocalDto, @Res({ passthrough: true }) response: Response) {
    return this.authService.createOtp(email, response);
  }

  /* Verify OTP for password reset */
  @ApiOperation({
    summary: 'Verify password reset',
    description:
      'Verify the user can reset the password by supplying the valid OTP. If the OTP is valid the JWT cookie is updated and the user will be able to set his new password',
  })
  @ApiResponse({
    status: 200,
    description:
      'The OTP verified and the JWT cookie is updated. Now the user is able to set his new password. If the cookie is expired, the user will need to request a new OTP.',
  })
  @Post('/verify-reset')
  @HttpCode(200)
  @UseGuards(OtpJwtAuthGuard)
  verifyOtp(
    @GetUser() user: User,
    @Body() dto: OtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.verifyOtp(user, dto, response);
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
  @UseGuards(OtpVerifiedAuthGuard)
  @Patch('/set-password')
  async setPassword(
    @GetUser() user: User,
    @Body() dto: NewPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.setPassword(user, dto.password);
    this.authService.clearOtpCookie(response);
  }

  @SkipThrottle()
  @MessagePattern('authenticate-websocket-token')
  @Serialize(AuthDto)
  async authenticateWebsocketToken(@Payload() payload: AuthenticateWebsocketTokenDto) {
    return this.authService.authenticateWebsocketToken(payload.jwt);
  }
}
