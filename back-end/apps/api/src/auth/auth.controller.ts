import { Body, Controller, HttpCode, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Response } from 'express';

import { User } from '@entities';

import { AdminGuard, JwtAuthGuard, LocalAuthGuard } from '../guards';

import { GetUser } from '../decorators';

import { Serialize } from '../interceptors/serialize.interceptor';

import { AuthService } from './auth.service';

import { AuthDto, ChangePasswordDto, SignUpUserDto } from './dtos';

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
  @UseGuards(JwtAuthGuard, AdminGuard)
  async signUp(@Body() dto: SignUpUserDto): Promise<User> {
    return this.authService.signUpByAdmin(dto);
  }

  /* User login */
  @ApiOperation({
    summary: 'Login in',
    description: 'Using the provided credentials, attempt to log the user into the organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'User is verified and an authentication token in a cookie is attached.',
  })
  @Post('/login')
  @HttpCode(200)
  @UseGuards(LocalAuthGuard)
  async login(@GetUser() user: User, @Res({ passthrough: true }) response: Response) {
    await this.authService.login(user, response);
    return user;
  }

  /* User log out */
  @ApiOperation({
    summary: 'Log out',
    description: 'Log the user out of the organization. This is not yet implemented.',
  })
  @ApiResponse({
    status: 201,
  })
  @Post('/logout')
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
}
