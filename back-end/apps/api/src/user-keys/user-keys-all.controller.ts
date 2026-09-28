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

import { UserKeyPublicDto } from './dtos';
import { UserKeysService } from './user-keys.service';

@ApiTags('User Keys All')
@Controller('user-keys')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class UserKeysAllController {
  constructor(private userKeysService: UserKeysService) {}

  @ApiOperation({
    summary: 'Get all user keys',
    description: 'Deprecated. Use keys embedded in GET /users instead.',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    type: PaginatedResourceDto<UserKeyPublicDto>,
  })
  @Get()
  @Serialize(withPaginatedResponse(UserKeyPublicDto))
  getUserKeys(
    @PaginationParams() paginationParams: Pagination,
  ): Promise<PaginatedResourceDto<UserKey>> {
    return this.userKeysService.getUserKeys(paginationParams);
  }
}
