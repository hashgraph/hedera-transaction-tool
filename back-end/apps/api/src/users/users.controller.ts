import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ErrorCodes, Serialize } from '@app/common';

import { User } from '@entities';

import { AdminGuard, JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';
import { AllowNonVerifiedUser, GetUser } from '../decorators';

import {
  UpdateUserDto,
  UserDto,
  UserWithClientsDto,
  VersionCheckDto,
  VersionCheckResponseDto,
} from './dtos';

import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary: 'Get all users',
    description: 'Get all users that are currently a part of the organization.',
  })
  @ApiResponse({
    status: 200,
    type: [UserWithClientsDto],
  })
  @Get()
  @Serialize(UserWithClientsDto)
  getUsers(@GetUser() requestingUser: User): Promise<User[]> {
    return this.usersService.getUsers(requestingUser);
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
  @Serialize(UserDto)
  getMe(@GetUser() user: User): User {
    return user;
  }

  @ApiOperation({
    summary: 'Get a specific user',
    description: 'Get a specific user from the organization for the given user id.',
  })
  @ApiResponse({
    status: 200,
    type: UserWithClientsDto,
  })
  @Get('/:id')
  @Serialize(UserWithClientsDto)
  getUser(@GetUser() requestingUser: User, @Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.usersService.getUserWithClients(id, requestingUser);
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
  @Serialize(UserDto)
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

  @ApiOperation({
    summary: 'Check and store client version',
    description:
      'Logs and persists the frontend version for the authenticated user. ' +
      'Returns information about available updates and minimum version requirements.',
  })
  @ApiResponse({
    status: 200,
    description: 'Version recorded successfully with update information',
    type: VersionCheckResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid version format',
  })
  @AllowNonVerifiedUser()
  @Post('/version-check')
  @Serialize(VersionCheckResponseDto)
  async versionCheck(
    @GetUser() user: User,
    @Body() dto: VersionCheckDto,
  ): Promise<VersionCheckResponseDto> {
    await this.usersService.updateClientVersion(user.id, dto.version);

    return this.usersService.getVersionCheckInfo(dto.version);
  }
}
