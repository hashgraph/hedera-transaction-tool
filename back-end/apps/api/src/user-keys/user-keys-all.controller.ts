import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  PaginatedResourceDto,
  Pagination,
  PaginationParams,
  Serialize,
  withPaginatedResponse,
} from '@app/common';
import { UserKey } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../guards';

import { UserKeyDto } from './dtos';
import { UserKeysService } from './user-keys.service';

@ApiTags('User Keys All')
@Controller('user-keys')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class UserKeysAllController {
  constructor(private userKeysService: UserKeysService) {}

  @ApiOperation({
    summary: 'Get all user keys for user',
    description: 'Get all the user keys for the provided user id.',
  })
  @ApiResponse({
    status: 200,
    type: PaginatedResourceDto<UserKeyDto>,
  })
  @Get()
  @Serialize(withPaginatedResponse(UserKeyDto))
  getUserKeys(
    @PaginationParams() paginationParams: Pagination,
  ): Promise<PaginatedResourceDto<UserKey>> {
    console.log('hereeee2');

    return this.userKeysService.getUserKeys(paginationParams);
  }
}
