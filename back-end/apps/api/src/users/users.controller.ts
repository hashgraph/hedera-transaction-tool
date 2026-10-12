import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ErrorCodes, Serialize } from '@app/common';

import { ApiKeyRevokedReason, User } from '@entities';

import { AdminGuard, JwtBlackListAuthGuard, JwtOrApiKeyGuard, VerifiedUserGuard } from '../guards';
import { AllowApiKey, AllowNonVerifiedUser, GetUser } from '../decorators';
import { ApiKeysService } from '../api-keys/api-keys.service';

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
@UseGuards(JwtBlackListAuthGuard, JwtOrApiKeyGuard, VerifiedUserGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  @ApiOperation({
    summary: 'Get all users',
    description:
      'Get all users that are currently a part of the organization. Accepts a JWT, or a ' +
      'GET-only read-only API key (X-Api-Key header).',
  })
  @ApiResponse({
    status: 200,
    type: [UserWithClientsDto],
  })
  @AllowApiKey()
  @Get()
  @Serialize(UserWithClientsDto)
  getUsers(@GetUser() requestingUser: User): Promise<User[]> {
    return this.usersService.getUsers(requestingUser);
  }

  @ApiOperation({
    summary: 'Get the current user',
    description:
      'Get the user that is currently a part of the organization. Accepts a JWT, or a ' +
      'GET-only read-only API key (X-Api-Key header).',
  })
  @ApiResponse({
    status: 200,
    type: UserDto,
  })
  @AllowNonVerifiedUser()
  @AllowApiKey()
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
  @Get('/public-owner/:publicKey')
  async getUserByPublicKey(
    @GetUser() requestingUser: User,
    @Param('publicKey') publicKey: string,
  ): Promise<string | null> {
    const ownerEmail = await this.usersService.getOwnerOfPublicKey(publicKey);

    this.logger.log(
      `Public key owner lookup: userId=${requestingUser.id} publicKey=${publicKey} found=${ownerEmail !== null}`,
    );

    return ownerEmail;
  }

  @ApiOperation({
    summary: 'Update user information',
    description:
      'Update the admin state and/or report-viewing permission of a user. Removing either ' +
      "one, when it leaves the user with no path to report access, revokes that user's " +
      'report API key.',
  })
  @ApiResponse({
    status: 200,
    type: UserDto,
  })
  @UseGuards(AdminGuard)
  @Patch('/:id')
  @Serialize(UserDto)
  async updateUser(
    @GetUser() admin: User,
    @Param('id', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    const before = await this.usersService.getUser({ id: userId });
    const wasEligibleForKey = !!before && (before.admin || before.canViewReports);

    const updated = await this.usersService.updateUserById(userId, dto);
    const stillEligibleForKey = updated.admin || updated.canViewReports;

    // Must compare the merged before/after entity, not the dto in isolation: dto fields are
    // optional (partial update), so e.g. demoting admin alone (dto.admin === false) can only be
    // known to remove eligibility by also knowing the current (possibly untouched) canViewReports.
    if (wasEligibleForKey && !stillEligibleForKey) {
      await this.apiKeysService.revoke(userId, ApiKeyRevokedReason.PERMISSION_REMOVED, admin.id);
    }

    return updated;
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
    return this.usersService.removeUser(id, user.id);
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
