import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Serialize } from '../interceptors/serialize.interceptor';
import { GetUser, IgnoreControllerGuard } from '../decorators';
import { UsersService } from './users.service';
import {
  AdminGuard,
  JwtAuthGuard,
  OtpJwtAuthGuard,
  OtpLocalAuthGuard,
  OtpVerifiedAuthGuard,
} from '../guards';
import { User } from '@entities';
import {
  ChangePasswordDto,
  CreateUserDto,
  NewPasswordDto,
  OtpDto,
  UpdateUserDto,
  UserDto,
} from './dtos';
import { Response } from 'express';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@Serialize(UserDto)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // user can't put in wrong email and get notified that it is wrong, '
  @ApiOperation({
    summary: 'Reset the password',
    description:
      'Begin the process of resetting a users password by creating and emailing an OTP to the user.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP created and sent.',
  })
  @IgnoreControllerGuard()
  @UseGuards(OtpLocalAuthGuard)
  @Post('/reset-password')
  async createOtp(@GetUser() user: User, @Res({ passthrough: true }) response: Response) {
    await this.usersService.createOtp(user, response);
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
  @IgnoreControllerGuard()
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
    //   but then what? i still need to get to the jwt somehow, then compare jwt to this verified
    //   and also, need to still do a super.canActivate or something so I can get the strategy.validate stuff
    //
    // }

    return this.usersService.verifyOtp(user, dto, response);
  }

  @ApiOperation({
    summary: 'Set the password',
    description: 'Set the password for the verified email.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password successfully set.',
  })
  @IgnoreControllerGuard()
  @UseGuards(OtpVerifiedAuthGuard)
  @Patch('/set-password')
  async setPassword(@GetUser() user: User, @Body() dto: NewPasswordDto): Promise<void> {
    return this.usersService.setPassword(user, dto.password);
  }

  @ApiOperation({
    summary: 'Create a user',
    description: 'Create a user for the organization. This action requires admin privileges.',
  })
  @ApiResponse({
    status: 201,
    type: [UserDto],
  })
  @UseGuards(AdminGuard)
  @Post()
  createUser(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.createUser(dto);
  }

  @ApiOperation({
    summary: 'Get all users',
    description: 'Get all users that are currently a part of the organization.',
  })
  @ApiResponse({
    status: 200,
    type: [UserDto],
  })
  @Get()
  getUsers(@GetUser() user: User): Promise<User[]> {
    return this.usersService.getUsers();
  }

  @ApiOperation({
    summary: 'Get the current user',
    description: 'Get the user that is currently a part of the organization.',
  })
  @ApiResponse({
    status: 200,
    type: [UserDto],
  })
  // @UseGuards(AdminGuard)
  @Get('/me')
  getMe(@GetUser() user: User): User {
    return user;
  }

  //TODO How/when would this be used?
  @ApiOperation({
    summary: 'Get a specific user',
    description: 'Get a specific user from the organization for the given user id.',
  })
  @ApiResponse({
    status: 200,
    type: UserDto,
  })
  @Get('/:id')
  getUser(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.usersService.getUser({ id });
  }

  // what did I do?????
  @ApiOperation({
    summary: 'Change password',
    description: 'Change the password of the current logged in user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password successfully changed.',
  })
  @Patch('/change-password')
  async changePassword(@GetUser() user: User, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.usersService.changePassword(user, dto);
  }

  //TODO If roles is to be used instead of just an admin flag, this is where it should be
  @ApiOperation({
    summary: 'Update user information',
    description: 'Update the admin state of a user.',
  })
  @ApiResponse({
    status: 200,
    type: UserDto,
  })
  @UseGuards(AdminGuard)
  @Patch('/:id')
  updateUser(@Param('id', ParseIntPipe) userId: number, @Body() dto: UpdateUserDto): Promise<User> {
    return this.usersService.updateUserById(userId, dto);
  }

  @ApiOperation({
    summary: 'Remove a user',
    description: 'Remove a user from the organization for the given id.',
  })
  @ApiResponse({
    status: 200,
  })
  @Delete('/:id')
  removeUser(@Param('id', ParseIntPipe) id: number): void {
    this.usersService.removeUser(id);
  }
}
