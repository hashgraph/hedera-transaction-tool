import { Body, Controller, Get, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto, UserDto } from '../users/dtos';
import { User } from '@entities';
import { Serialize } from '../interceptors/serialize.interceptor';
import { AuthDto, NewPasswordDto, OtpDto } from './dto';
import { GetUser } from '../decorators/get-user.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LocalAuthGuard, OtpJwtAuthGuard, OtpLocalAuthGuard, OtpVerifiedAuthGuard } from '../guards';

@ApiTags('Authentication')
@Controller('auth')
@Serialize(AuthDto)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Create a new User',
    description:
      'TEMPORARY! This method will be an admin-role protected method. It is included now for testing.',
  })
  @ApiResponse({
    status: 201,
    type: UserDto,
  })
  @Post('/signup')
  async signUp(@Body() dto: CreateUserDto): Promise<User> {
    return this.authService.signUp(dto);
  }

  @ApiOperation({
    summary: 'Reset the password',
    description: 'Begin the process of resetting a users password by creating and emailing an OTP to the user.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP created and sent.',
  })
  @UseGuards(OtpLocalAuthGuard)
  @Post('/reset-password')
  async createOtp(
    @GetUser() user: User,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.createOtp(user, response);
    return 'success';
  }

  @ApiOperation({
    summary: 'Verify password reset',
    description: 'Verify the user can reset the password by supplying the valid OTP.',
  })
  @ApiResponse({
    status: 201,
    description: 'OTP verified.',
  })
  @UseGuards(OtpJwtAuthGuard)
  @Post('/verify-reset')
  verifyOtp(
    @GetUser() user: User,
    @Body() dto: OtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    //TODO
    // handle the incorrect token error,
    //   furthermore, if a use has a valid token, why would we save the credentials locally at all? its all in the token. so it the saved credentials would only
    // be used in the case of an expired token (and expired refresh token) - should look into this
    //
    // also, I should be able to do something like this in order to get the dynamic guard
    // export const Verified = (verified: boolean) => SetMetadata('verified', roles);
    // then
    // @Verified(true)
    // then in otp guard
    // canActivate(context: ExecutionContext): boolean {
    //   const verified = this.reflector.get<boolean>('verified', context.getHandler());
    //   but thenn what? i still need to get to the jwt somehow, then compare jwt to this verified
    //   and also, need to still do a super.cannActivate or something so I can get the strategy.validate stuff
    //
    // }


    return this.authService.verifyOtp(user, dto, response);
  }

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
  ): Promise<void> {
    return this.authService.setPassword(user, dto.password);
  }

  @ApiOperation({
    summary: 'Login in',
    description: 'Using the provided credentials, attempt to log the user into the organization.',
  })
  @ApiResponse({
    status: 201,
    description: 'User authenticated.'
  })
  @UseGuards(LocalAuthGuard)
  @Post('/login')
  async login(
    @GetUser() user: User,
    @Res({ passthrough: true }) response: Response
  ) {
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
  logout(@GetUser() user: User) {
    console.log(user.id);
    // return this.authService.signOut(req.user['sub']);
  }

  //lesson 18
  // @MessagePattern('authenticate')
  // async authentiate() {}
}
