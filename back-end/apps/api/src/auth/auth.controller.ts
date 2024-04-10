import { Body, Controller, HttpCode, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Response } from 'express';

import { User } from '@entities';

import { AdminGuard, JwtAuthGuard, LocalAuthGuard } from '../guards';

import { GetUser } from '../decorators';

import { Serialize } from '../interceptors/serialize.interceptor';

import { AuthService } from './auth.service';

import { UserDto } from '../users/dtos';
import { AuthDto, SignUpUserDto } from './dtos';

@ApiTags('Authentication')
@Controller('auth')
@Serialize(AuthDto)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Create a new User',
    description:
      "Admins can create a new user by providing an email for the user. The password will be generated and sent to the user's email.",
  })
  @ApiResponse({
    status: 201,
    type: UserDto,
  })
  @Post('/signup')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async signUp(@Body() dto: SignUpUserDto): Promise<User> {
    return this.authService.signUpByAdmin(dto);
  }

  @ApiOperation({
    summary: 'Login in',
    description: 'Using the provided credentials, attempt to log the user into the organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'User is verified and an authentication token in a cookie is attached.',
  })
  @UseGuards(LocalAuthGuard)
  @HttpCode(200)
  @Post('/login')
  async login(@GetUser() user: User, @Res({ passthrough: true }) response: Response) {
    await this.authService.login(user, response);
    return user;
  }

  @ApiOperation({
    summary: 'Log out',
    description: 'Log the user out of the organization. This is not yet implemented.',
  })
  @ApiResponse({
    status: 201,
  })
  @Post('/logout')
  @UseGuards(JwtAuthGuard)
  logout(@GetUser() user: User) {
    console.log(user.id);
    // return this.authService.signOut(req.user['sub']);
  }

  //lesson 18
  // @MessagePattern('authenticate')
  // async authentiate() {}
}
