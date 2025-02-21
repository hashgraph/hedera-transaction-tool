import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ErrorCodes, Serialize } from '@app/common';

import { User } from '@entities';

import { AdminGuard, JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';
import { AllowNonVerifiedUser, GetUser } from '../decorators';

import { UpdateUserDto, UserDto } from './dtos';

import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
@Serialize(UserDto)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Get all users',
    description: 'Get all users that are currently a part of the organization.',
  })
  @ApiResponse({
    status: 200,
    type: [UserDto],
  })
  @Get()
  getUsers(): Promise<User[]> {
    return this.usersService.getUsers();
  }

  @ApiOperation({
    summary: 'Get the current user',
    description: 'Get the user that is currently a part of the organization.',
  })
  @ApiResponse({
    status: 200,
    type: UserDto,
  })
  @AllowNonVerifiedUser()
  @Get('/me')
  getMe(@GetUser() user: User): User {
    return user;
  }

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

  @ApiOperation({
    summary: 'Get owner of a public key',
    description: 'Fetch a user email based on a public key.',
  })
  @ApiResponse({
    status: 200,
    type: String,
  })
  @AllowNonVerifiedUser()
  @Get('/public-owner/:publicKey')
  getUserByPublicKey(@Param('publicKey') publicKey: string): Promise<string | null> {
    return this.usersService.getOwnerOfPublicKey(publicKey);
  }

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
    type: Boolean,
  })
  @UseGuards(AdminGuard)
  @Delete('/:id')
  removeUser(@GetUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<boolean> {
    if (user.id === id) throw new BadRequestException(ErrorCodes.CRYFO);
    return this.usersService.removeUser(id);
  }
}
