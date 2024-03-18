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
import { ApiTags } from '@nestjs/swagger';

@ApiTags('User Keys')
@Controller('user/:userId?/keys')
@UseGuards(JwtAuthGuard)
@Serialize(UserKeyDto)
export class UserKeysController {
  constructor(private userKeysService: UserKeysService) {}

  @Post()
  uploadKey(@GetUser() user: User, @Body() body: UploadUserKeyDto) {
    return this.userKeysService.uploadKey(user, body);
  }

  @Get()
  async getKeysById(@Param('userId', ParseIntPipe) userId: number) {
    const userKeys = await this.userKeysService.getKeysById(userId);
    return userKeys;
  }

  @Delete('/:id')
  removeKey(@Param('id', ParseIntPipe) id: number) {
    // If this returns the result, the dto can't decode the id as things are null
    this.userKeysService.removeKey(id);
  }
}
