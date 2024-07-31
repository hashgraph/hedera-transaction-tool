import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Serialize } from '@app/common';

import { User, UserKey } from '@entities';

import { JwtAuthGuard, VerifiedUserGuard } from '../guards';

import { GetUser } from '../decorators';

import { UserKeysService } from './user-keys.service';

import { UploadUserKeyDto, UserKeyDto } from './dtos';

@ApiTags('User Keys')
@Controller('user/:userId?/keys')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
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
  getUserKeys(@Param('userId', ParseIntPipe) userId: number): Promise<UserKey[]> {
    return this.userKeysService.getUserKeys(userId);
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
}
