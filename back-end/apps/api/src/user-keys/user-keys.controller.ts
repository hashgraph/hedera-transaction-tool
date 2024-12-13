import {
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

import { Serialize } from '@app/common';
import { User, UserKey } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';
import { GetUser } from '../decorators';

import { UpdateUserKeyMnemonicHashDto, UploadUserKeyDto, UserKeyDto } from './dtos';
import { UserKeysService } from './user-keys.service';

@ApiTags('User Keys')
@Controller('user/:userId?/keys')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
@Serialize(UserKeyDto)
export class UserKeysController {
  constructor(private userKeysService: UserKeysService) {}

  @ApiOperation({
    summary: 'Upload a user key',
    description: 'Upload a user key for the current user.',
  })
  @ApiResponse({
    status: 201,
    type: UserKeyDto,
  })
  @Post()
  uploadKey(@GetUser() user: User, @Body() body: UploadUserKeyDto): Promise<UserKey> {
    return this.userKeysService.uploadKey(user, body);
  }

  @ApiOperation({
    summary: 'Get all user keys for user',
    description: 'Get all the user keys for the provided user id.',
  })
  @ApiResponse({
    status: 200,
    type: [UserKeyDto],
  })
  @Get()
  getUserKeys(
    @GetUser() user: User,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<UserKey[]> {
    return this.userKeysService.getUserKeysRestricted(user, userId);
  }

  @ApiOperation({
    summary: 'Remove user key',
    description: 'Remove the user key for the provided user key id.',
  })
  @ApiResponse({
    status: 200,
    type: Boolean,
  })
  @Delete('/:id')
  async removeKey(@GetUser() user: User, @Param('id', ParseIntPipe) id: number): Promise<boolean> {
    // If this returns the result, the dto can't decode the id as things are null
    return this.userKeysService.removeUserKey(user, id);
  }

  @ApiOperation({
    summary: "Updates user key's mnemonic hash and/or index",
    description: 'Updates the mnemonic hash and/or index for the provided user key id.',
  })
  @ApiResponse({
    status: 200,
    type: UserKeyDto,
  })
  @Patch('/:id')
  async updateKey(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserKeyMnemonicHashDto,
  ): Promise<UserKey> {
    return this.userKeysService.updateMnemonicHash(user, id, body);
  }
}
