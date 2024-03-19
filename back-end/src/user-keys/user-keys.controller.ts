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
import { Serialize } from '../interceptors/serialize.interceptor';
import { UserKeysService } from './user-keys.service';
import { UploadUserKeyDto } from './dtos/upload-user-key.dto';
import { GetUser } from '../decorators/get-user.decorator';
import { User } from '../entities/user.entity';
import { UserKeyDto } from './dtos/user-key.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserKey } from '../entities/user-key.entity';

@ApiTags('User Keys')
@Controller('user/:userId?/keys')
@UseGuards(JwtAuthGuard)
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
    status: 201,
    type: [UserKeyDto],
  })
  @Get()
  getUserKeysByUserId(@Param('userId', ParseIntPipe) userId: number): Promise<UserKey[]> {
    return this.userKeysService.getUserKeysByUserId(userId);
  }

  @ApiOperation({
    summary: 'Remove user key',
    description: 'Remove the user key for the provided user key id.',
  })
  @ApiResponse({
    status: 201,
  })
  @Delete('/:id')
  removeKey(@Param('id', ParseIntPipe) id: number): void {
    // If this returns the result, the dto can't decode the id as things are null
    this.userKeysService.removeKey(id);
  }
}
